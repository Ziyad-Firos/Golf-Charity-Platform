import { Router } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import pool from '../db';

const router = Router();

router.get('/current', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, 
              COUNT(dw.id) as winner_count
       FROM draws d
       LEFT JOIN draw_winners dw ON d.id = dw.draw_id
       WHERE d.status = 'published'
       ORDER BY d.draw_month DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.json({ message: 'No published draws found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Current draw fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch current draw' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM draws WHERE status = \'published\' ORDER BY draw_month DESC LIMIT 12'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Draw history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch draw history' });
  }
});

router.post('/simulate', authenticateToken, requireAdmin, [
  body('drawMonth').isISO8601().toDate(),
  body('drawMode').isIn(['random', 'algorithmic']),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { drawMonth, drawMode } = req.body;

    const activeSubscribersResult = await pool.query(
      'SELECT COUNT(*) FROM subscribers WHERE subscription_state = \'active\''
    );
    const activeSubscriberCount = parseInt((activeSubscribersResult.rows[0] as any).count);

    const monthlyRevenue = activeSubscriberCount * 999;
    const prizePool = monthlyRevenue * 0.20;

    const drawNumbers = Array.from({ length: 5 }, () => Math.floor(Math.random() * 45) + 1);

    const simulatedDraw = {
      drawMonth,
      drawMode,
      drawNumbers,
      prizePool: prizePool / 100,
      activeSubscriberCount,
      tier5Amount: (prizePool * 0.40) / 100,
      tier4Amount: (prizePool * 0.35) / 100,
      tier3Amount: (prizePool * 0.25) / 100,
    };

    res.json({ message: 'Draw simulation completed', simulation: simulatedDraw });
  } catch (error) {
    console.error('Draw simulation error:', error);
    res.status(500).json({ error: 'Failed to simulate draw' });
  }
});

router.post('/publish', authenticateToken, requireAdmin, [
  body('drawMonth').isISO8601().toDate(),
  body('drawMode').isIn(['random', 'algorithmic']),
  body('drawNumbers').isArray({ min: 5, max: 5 }),
  body('prizePoolTotal').isFloat({ min: 0 }),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { drawMonth, drawMode, drawNumbers, prizePoolTotal } = req.body;

    const existingDraw = await pool.query(
      'SELECT id FROM draws WHERE draw_month = $1',
      [drawMonth]
    );

    if (existingDraw.rows.length > 0) {
      return res.status(400).json({ error: 'Draw for this month already exists' });
    }

    const tier5Amount = prizePoolTotal * 0.40;
    const tier4Amount = prizePoolTotal * 0.35;
    const tier3Amount = prizePoolTotal * 0.25;

    const result = await pool.query(
      `INSERT INTO draws (draw_month, draw_mode, draw_numbers, prize_pool_total, 
                          tier_5_amount, tier_4_amount, tier_3_amount, status, 
                          published_at, published_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', NOW(), $8) RETURNING *`,
      [drawMonth, drawMode, drawNumbers, prizePoolTotal, tier5Amount, tier4Amount, tier3Amount, req.user!.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Draw publish error:', error);
    res.status(500).json({ error: 'Failed to publish draw' });
  }
});

export default router;
