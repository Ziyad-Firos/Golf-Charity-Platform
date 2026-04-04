import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../db';

const router = Router();

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName } = req.body;

    const existingUser = await pool.query(
      'SELECT id FROM subscribers WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO subscribers (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0] as any;
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!
    );

    res.status(201).json({
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, subscription_state FROM subscribers WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0] as any;
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!
    );

    res.json({
      user: {
        id: (user as any).id,
        email: (user as any).email,
        firstName: (user as any).first_name,
        lastName: (user as any).last_name,
        role: (user as any).role,
        subscriptionState: (user as any).subscription_state
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, subscription_state,
              stripe_customer_id, charity_id, charity_contribution_pct,
              currency, locale, created_at, updated_at
       FROM subscribers WHERE id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: (user as any).id,
      email: (user as any).email,
      firstName: (user as any).first_name,
      lastName: (user as any).last_name,
      role: (user as any).role,
      subscriptionState: (user as any).subscription_state,
      stripeCustomerId: (user as any).stripe_customer_id,
      charityId: (user as any).charity_id,
      charityContributionPct: (user as any).charity_contribution_pct,
      currency: (user as any).currency,
      locale: (user as any).locale,
      createdAt: (user as any).created_at,
      updatedAt: (user as any).updated_at
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
