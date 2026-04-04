import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import pool from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, image_urls, is_featured, is_active FROM charities WHERE is_active = true ORDER BY is_featured DESC, name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Charities fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch charities' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, ce.title, ce.event_date, ce.description as event_description
       FROM charities c
       LEFT JOIN charity_events ce ON c.id = ce.charity_id
       WHERE c.id = $1 AND c.is_active = true
       ORDER BY ce.event_date DESC`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Charity not found' });
    }

    const charity = {
      id: (result.rows[0] as any).id,
      name: (result.rows[0] as any).name,
      description: (result.rows[0] as any).description,
      image_urls: (result.rows[0] as any).image_urls,
      is_featured: (result.rows[0] as any).is_featured,
      is_active: (result.rows[0] as any).is_active,
      events: result.rows.map(row => ({
        title: (row as any).title,
        event_date: (row as any).event_date,
        description: (row as any).event_description
      })).filter(event => event.title)
    };

    res.json(charity);
  } catch (error) {
    console.error('Charity fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch charity' });
  }
});

router.post('/', authenticateToken, [
  body('name').notEmpty().trim(),
  body('description').optional(),
  body('imageUrls').optional().isArray(),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, imageUrls } = req.body;

    const result = await pool.query(
      'INSERT INTO charities (name, description, image_urls) VALUES ($1, $2, $3) RETURNING *',
      [name, description, imageUrls || []]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Charity creation error:', error);
    res.status(500).json({ error: 'Failed to create charity' });
  }
});

export default router;
