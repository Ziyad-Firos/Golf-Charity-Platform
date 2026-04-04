import Stripe from 'stripe';
import { query } from '../db/client';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_pence: number;
  interval: string;
  prize_pool_contribution_pct: string;
  charity_contribution_pct: string;
}

export interface SubscriberRow {
  id: string;
  email: string;
  subscription_state: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

const VALID_STATES = ['active', 'inactive', 'lapsed', 'cancelled'] as const;
export type SubscriptionState = (typeof VALID_STATES)[number];

export function isValidState(state: string): state is SubscriptionState {
  return (VALID_STATES as readonly string[]).includes(state);
}

export async function getActivePlans(): Promise<SubscriptionPlan[]> {
  return query<SubscriptionPlan>(
    `SELECT id, name, price_pence, interval, prize_pool_contribution_pct, charity_contribution_pct
     FROM subscription_plans
     WHERE active = true
     ORDER BY price_pence ASC`
  );
}

export async function getPlanById(planId: string): Promise<SubscriptionPlan & { stripe_price_id: string } | null> {
  const rows = await query<SubscriptionPlan & { stripe_price_id: string }>(
    `SELECT id, name, price_pence, interval, stripe_price_id, prize_pool_contribution_pct, charity_contribution_pct
     FROM subscription_plans
     WHERE id = $1 AND active = true`,
    [planId]
  );
  return rows[0] ?? null;
}

export async function getSubscriberById(subscriberId: string): Promise<SubscriberRow | null> {
  const rows = await query<SubscriberRow>(
    `SELECT id, email, subscription_state, stripe_customer_id, stripe_subscription_id
     FROM subscribers
     WHERE id = $1`,
    [subscriberId]
  );
  return rows[0] ?? null;
}

export async function createCheckoutSession(
  subscriberId: string,
  stripePriceId: string,
  clientUrl: string
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: stripePriceId, quantity: 1 }],
    client_reference_id: subscriberId,
    success_url: `${clientUrl}/dashboard?checkout=success`,
    cancel_url: `${clientUrl}/register?checkout=cancelled`,
  });
}

export async function updateSubscriberState(
  subscriberId: string,
  newState: SubscriptionState,
  changedBy: string | null,
  reason: string | null,
  extra?: { stripe_customer_id?: string; stripe_subscription_id?: string }
): Promise<void> {
  // Fetch current state for the log
  const rows = await query<{ subscription_state: string }>(
    'SELECT subscription_state FROM subscribers WHERE id = $1',
    [subscriberId]
  );
  const oldState = rows[0]?.subscription_state ?? null;

  // Only update if state actually changed (or if extra fields need updating)
  if (extra?.stripe_customer_id !== undefined || extra?.stripe_subscription_id !== undefined) {
    await query(
      `UPDATE subscribers
       SET subscription_state = $1,
           stripe_customer_id = COALESCE($2, stripe_customer_id),
           stripe_subscription_id = COALESCE($3, stripe_subscription_id),
           updated_at = NOW()
       WHERE id = $4`,
      [
        newState,
        extra.stripe_customer_id ?? null,
        extra.stripe_subscription_id ?? null,
        subscriberId,
      ]
    );
  } else {
    await query(
      `UPDATE subscribers SET subscription_state = $1, updated_at = NOW() WHERE id = $2`,
      [newState, subscriberId]
    );
  }

  // Log the transition
  await query(
    `INSERT INTO subscription_state_log (subscriber_id, old_state, new_state, changed_by, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [subscriberId, oldState, newState, changedBy, reason]
  );
}

export async function findSubscriberByStripeCustomerId(
  stripeCustomerId: string
): Promise<SubscriberRow | null> {
  const rows = await query<SubscriberRow>(
    `SELECT id, email, subscription_state, stripe_customer_id, stripe_subscription_id
     FROM subscribers
     WHERE stripe_customer_id = $1`,
    [stripeCustomerId]
  );
  return rows[0] ?? null;
}

export async function findSubscriberByStripeSubscriptionId(
  stripeSubscriptionId: string
): Promise<SubscriberRow | null> {
  const rows = await query<SubscriberRow>(
    `SELECT id, email, subscription_state, stripe_customer_id, stripe_subscription_id
     FROM subscribers
     WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId]
  );
  return rows[0] ?? null;
}
