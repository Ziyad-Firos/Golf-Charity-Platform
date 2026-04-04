import { Router, Request, Response } from 'express';
import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin, requireActiveSubscription } from '../middleware/auth.middleware';
import {
  stripe,
  getActivePlans,
  getPlanById,
  getSubscriberById,
  createCheckoutSession,
  updateSubscriberState,
  findSubscriberByStripeCustomerId,
  isValidState,
  SubscriptionState,
} from '../services/subscription.service';
import Stripe from 'stripe';

// ─── Subscriber routes ────────────────────────────────────────────────────────

export const subscriptionRouter = Router();

// Task 5.1 — GET /api/subscriptions/plans (public)
subscriptionRouter.get('/plans', async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = await getActivePlans();
    res.json({ plans });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// Task 5.2 — POST /api/subscriptions/checkout (requires auth)
subscriptionRouter.post(
  '/checkout',
  authenticateToken,
  [body('planId').notEmpty().withMessage('planId is required')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg },
      });
      return;
    }

    const { planId } = req.body as { planId: string };

    try {
      const plan = await getPlanById(planId);
      if (!plan) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription plan not found' } });
        return;
      }

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const session = await createCheckoutSession(req.user!.id, plan.stripe_price_id, clientUrl);

      res.json({ url: session.url });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// Task 5.4 — GET /api/subscriptions/status (requires auth)
subscriptionRouter.get('/status', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const subscriber = await getSubscriberById(req.user!.id);
    if (!subscriber) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscriber not found' } });
      return;
    }

    let nextRenewalDate: string | null = null;

    if (subscriber.stripe_subscription_id) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscriber.stripe_subscription_id);
        if (stripeSub.current_period_end) {
          nextRenewalDate = new Date(stripeSub.current_period_end * 1000).toISOString();
        }
      } catch {
        // Stripe lookup failed — return null renewal date rather than erroring
      }
    }

    res.json({
      subscriptionState: subscriber.subscription_state,
      stripeSubscriptionId: subscriber.stripe_subscription_id,
      nextRenewalDate,
    });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// Task 5.4 — POST /api/subscriptions/cancel (requires auth + active subscription)
subscriptionRouter.post(
  '/cancel',
  authenticateToken,
  requireActiveSubscription,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const subscriber = await getSubscriberById(req.user!.id);
      if (!subscriber || !subscriber.stripe_subscription_id) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'No active Stripe subscription found' },
        });
        return;
      }

      await stripe.subscriptions.update(subscriber.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      await updateSubscriberState(req.user!.id, 'cancelled', null, 'Subscriber requested cancellation');

      res.json({ message: 'Subscription will be cancelled at the end of the current billing period' });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);

// Task 5.3 — POST /api/subscriptions/webhook (raw body, Stripe signature verification)
// NOTE: This route uses express.raw() — it must be mounted BEFORE express.json() in app.ts
// The router itself does not apply json middleware; the raw middleware is applied at mount time.
export const webhookRouter = Router();

webhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Webhook secret not configured' } });
      return;
    }

    if (!sig) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing Stripe signature' } });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signature verification failed';
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
      return;
    }

    try {
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } });
    }
  }
);

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriberId = session.client_reference_id;
      if (!subscriberId) return;

      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
      const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;

      await updateSubscriberState(subscriberId, 'active', null, 'Stripe checkout completed', {
        stripe_customer_id: stripeCustomerId ?? undefined,
        stripe_subscription_id: stripeSubscriptionId ?? undefined,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;

      const subscriber = await findSubscriberByStripeCustomerId(customerId);
      if (!subscriber) return;

      await updateSubscriberState(subscriber.id, 'lapsed', null, 'Stripe invoice payment failed');
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (!customerId) return;

      const subscriber = await findSubscriberByStripeCustomerId(customerId);
      if (!subscriber) return;

      await updateSubscriberState(subscriber.id, 'inactive', null, 'Stripe subscription deleted');
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      // Only handle renewals (not the initial payment which is covered by checkout.session.completed)
      if (invoice.billing_reason === 'subscription_create') return;

      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;

      const subscriber = await findSubscriberByStripeCustomerId(customerId);
      if (!subscriber) return;

      if (subscriber.subscription_state !== 'active') {
        await updateSubscriberState(subscriber.id, 'active', null, 'Stripe invoice payment succeeded (renewal)');
      }
      break;
    }

    default:
      // Unhandled event type — ignore
      break;
  }
}

// ─── Admin routes ─────────────────────────────────────────────────────────────

export const adminSubscriptionRouter = Router();

// Task 5.4 — PATCH /api/admin/subscriptions/:id/state (requires auth + admin)
adminSubscriptionRouter.patch(
  '/:id/state',
  authenticateToken,
  requireAdmin,
  [
    param('id').isUUID().withMessage('Invalid subscriber ID'),
    body('state')
      .isIn(['active', 'inactive', 'lapsed', 'cancelled'])
      .withMessage('state must be one of: active, inactive, lapsed, cancelled'),
    body('reason').optional().isString().trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg },
      });
      return;
    }

    const { id } = req.params;
    const { state, reason } = req.body as { state: string; reason?: string };

    if (!isValidState(state)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'state must be one of: active, inactive, lapsed, cancelled' },
      });
      return;
    }

    try {
      const subscriber = await getSubscriberById(id);
      if (!subscriber) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscriber not found' } });
        return;
      }

      await updateSubscriberState(id, state as SubscriptionState, req.user!.id, reason ?? null);

      res.json({ message: 'Subscription state updated', state });
    } catch {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  }
);
