import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import pool from '../db';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, stableford_score, played_on, created_at, updated_at
       FROM score_entries 
       WHERE subscriber_id = $1 
       ORDER BY played_on DESC, created_at DESC
       LIMIT 5`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Scores fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

router.post('/', authenticateToken, [
  body('stablefordScore').isInt({ min: 1, max: 45 }),
  body('playedOn').isISO8601().toDate(),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { stablefordScore, playedOn } = req.body;

    const existingScoresCount = await pool.query(
      'SELECT COUNT(*) FROM score_entries WHERE subscriber_id = $1',
      [req.user!.id]
    );

    const count = parseInt((existingScoresCount.rows[0] as any).count);

    if (count >= 5) {
      await pool.query(
        `DELETE FROM score_entries 
         WHERE id = (
           SELECT id FROM score_entries 
           WHERE subscriber_id = $1 
           ORDER BY played_on ASC, created_at ASC 
           LIMIT 1
         )`,
        [req.user!.id]
      );
    }

    const result = await pool.query(
      'INSERT INTO score_entries (subscriber_id, stableford_score, played_on) VALUES ($1, $2, $3) RETURNING *',
      [req.user!.id, stablefordScore, playedOn]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Score creation error:', error);
    res.status(500).json({ error: 'Failed to create score' });
  }
});

router.put('/:id', authenticateToken, [
  body('stablefordScore').isInt({ min: 1, max: 45 }),
  body('playedOn').isISO8601().toDate(),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { stablefordScore, playedOn } = req.body;

    const ownershipCheck = await pool.query(
      'SELECT subscriber_id FROM score_entries WHERE id = $1',
      [id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Score not found' });
    }

    if ((ownershipCheck.rows[0] as any).subscriber_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'UPDATE score_entries SET stableford_score = $1, played_on = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [stablefordScore, playedOn, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Score update error:', error);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const ownershipCheck = await pool.query(
      'SELECT subscriber_id FROM score_entries WHERE id = $1',
      [id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Score not found' });
    }

    if ((ownershipCheck.rows[0] as any).subscriber_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('DELETE FROM score_entries WHERE id = $1', [id]);

    res.json({ message: 'Score deleted successfully' });
  } catch (error) {
    console.error('Score deletion error:', error);
    res.status(500).json({ error: 'Failed to delete score' });
  }
});

export default router;
