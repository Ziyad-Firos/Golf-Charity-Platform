import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import pool from '../db';

const router = Router();

router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscription_plans WHERE active = true ORDER BY price_pence ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

router.post('/create-checkout-session', authenticateToken, [
  body('priceId').notEmpty(),
  body('charityId').optional().isUUID(),
  body('charityContributionPct').optional().isFloat({ min: 10, max: 100 }),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { priceId, charityId, charityContributionPct } = req.body;

    const planResult = await pool.query(
      'SELECT * FROM subscription_plans WHERE stripe_price_id = $1 AND active = true',
      [priceId]
    );

    if (planResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    if (charityId) {
      await pool.query(
        'UPDATE subscribers SET charity_id = $1, charity_contribution_pct = $2 WHERE id = $3',
        [charityId, charityContributionPct || 10, req.user!.id]
      );
    }

    res.json({ 
      message: 'Checkout session would be created here',
      priceId,
      amount: (planResult.rows[0] as any).price_pence
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT subscription_state, stripe_subscription_id, created_at, updated_at
       FROM subscribers WHERE id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      subscriptionState: (result.rows[0] as any).subscription_state,
      stripeSubscriptionId: (result.rows[0] as any).stripe_subscription_id,
      createdAt: (result.rows[0] as any).created_at,
      updatedAt: (result.rows[0] as any).updated_at
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

export default router;
