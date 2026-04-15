import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { query } from '../db/client';
import { logger } from '../utils/logger';

const router = Router();

const BCRYPT_COST = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface SubscriberRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  subscription_state: string;
}

function issueAccessToken(payload: { sub: string; email: string; role: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ sub: payload.sub, email: payload.email, role: payload.role }, secret);
}

function issueRefreshToken(payload: { sub: string }): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET not configured');
  return jwt.sign({ sub: payload.sub }, secret);
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/auth',
  });
}

router.post('/register', [
  body('email').isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').notEmpty().withMessage('First name is required').trim(),
  body('lastName').notEmpty().withMessage('Last name is required').trim(),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fields: Record<string, string> = {};
    for (const err of errors.array()) {
      const field = (err as { path?: string }).path;
      if (field) fields[field] = err.msg;
    }
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields },
    });
    return;
  }

  const { email, password, firstName, lastName } = req.body as {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };

  try {
    // Check for existing email
    const existing = await query<{ id: string }>(
      'SELECT id FROM subscribers WHERE email = $1',
      [email]
    );
    if (existing.length > 0) {
      res.status(409).json({
        error: { code: 'VALIDATION_ERROR', message: 'An account with this email already exists', fields: { email: 'Email already in use' } },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const inserted = await query<SubscriberRow>(
      `INSERT INTO subscribers (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, role`,
      [email, passwordHash, firstName, lastName]
    );

    const subscriber = inserted[0];
    const accessToken = issueAccessToken({ sub: subscriber.id, email: subscriber.email, role: subscriber.role });
    const refreshToken = issueRefreshToken({ sub: subscriber.id });

    setRefreshCookie(res, refreshToken);

    logger.info('User registered successfully', {
      userId: subscriber.id,
      email: subscriber.email,
      ip: req.ip
    });

    res.status(201).json({
      user: {
        id: subscriber.id,
        email: subscriber.email,
        firstName: subscriber.first_name,
        lastName: subscriber.last_name,
        role: subscriber.role,
      },
      accessToken,
    });
  } catch (error) {
    logger.error('Registration failed', {
      email,
      error: (error as Error).message,
      ip: req.ip
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Invalid credentials').normalizeEmail(),
  body('password').notEmpty().withMessage('Invalid credentials'),
], async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(401).json({
      error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' },
    });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };

  try {
    const rows = await query<SubscriberRow>(
      'SELECT id, email, first_name, last_name, role, password_hash FROM subscribers WHERE email = $1',
      [email]
    );

    // Always compare to prevent timing attacks; use a dummy hash if not found
    const DUMMY_HASH = '$2b$12$invalidhashfortimingprotectiononly000000000000000000000';
    const subscriber = rows[0] ?? null;
    const hashToCheck = subscriber?.password_hash || DUMMY_HASH;
    
    const isValidPassword = await bcrypt.compare(password, hashToCheck);

    if (!isValidPassword || !subscriber) {
      logger.warn('Login attempt failed', {
        email,
        reason: !subscriber ? 'user_not_found' : 'invalid_password',
        ip: req.ip
      });
      
      res.status(401).json({
        error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' },
      });
      return;
    }

    const accessToken = issueAccessToken({ sub: subscriber.id, email: subscriber.email, role: subscriber.role });
    const refreshToken = issueRefreshToken({ sub: subscriber.id });

    setRefreshCookie(res, refreshToken);

    logger.info('User logged in successfully', {
      userId: subscriber.id,
      email: subscriber.email,
      ip: req.ip
    });

    res.json({
      user: {
        id: subscriber.id,
        email: subscriber.email,
        firstName: subscriber.first_name,
        lastName: subscriber.last_name,
        role: subscriber.role,
      },
      accessToken,
    });
  } catch (error) {
    logger.error('Login failed', {
      email,
      error: (error as Error).message,
      ip: req.ip
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    res.status(401).json({
      error: { code: 'AUTH_NO_REFRESH_TOKEN', message: 'Refresh token required' },
    });
    return;
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET not configured');

    const decoded = jwt.verify(refreshToken, secret) as { sub: string };
    
    const rows = await query<SubscriberRow>(
      'SELECT id, email, role FROM subscribers WHERE id = $1',
      [decoded.sub]
    );

    if (rows.length === 0) {
      res.status(401).json({
        error: { code: 'AUTH_INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
      });
      return;
    }

    const subscriber = rows[0];
    const newAccessToken = issueAccessToken({ sub: subscriber.id, email: subscriber.email, role: subscriber.role });
    const newRefreshToken = issueRefreshToken({ sub: subscriber.id });

    setRefreshCookie(res, newRefreshToken);

    logger.info('Token refreshed successfully', {
      userId: subscriber.id,
      ip: req.ip
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    logger.error('Token refresh failed', {
      error: (error as Error).message,
      ip: req.ip
    });
    res.status(401).json({
      error: { code: 'AUTH_INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
    });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  res.clearCookie('refresh_token', { path: '/api/auth' });
  
  logger.info('User logged out', {
    ip: req.ip
  });

  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await query<SubscriberRow>(
      'SELECT id, email, first_name, last_name, role, subscription_state FROM subscribers WHERE id = $1',
      [req.user!.id]
    );

    if (rows.length === 0) {
      res.status(404).json({
        error: { code: 'AUTH_USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    const subscriber = rows[0];

    res.json({
      user: {
        id: subscriber.id,
        email: subscriber.email,
        firstName: subscriber.first_name,
        lastName: subscriber.last_name,
        role: subscriber.role,
        subscriptionState: subscriber.subscription_state,
      },
    });
  } catch (error) {
    logger.error('Get user profile failed', {
      userId: req.user?.id,
      error: (error as Error).message,
      ip: req.ip
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// GET /api/auth/profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      'SELECT id, email, first_name, last_name, role, subscription_state, stripe_customer_id, charity_id, charity_contribution_pct, currency, locale, created_at, updated_at FROM subscribers WHERE id = $1',
      [req.user!.id]
    );

    if (result.length === 0) {
      res.status(404).json({
        error: { code: 'AUTH_USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    const user = result[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      subscriptionState: user.subscription_state,
      stripeCustomerId: user.stripe_customer_id,
      charityId: user.charity_id,
      charityContributionPct: user.charity_contribution_pct,
      currency: user.currency,
      locale: user.locale,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    logger.error('Get user profile failed', {
      userId: req.user?.id,
      error: (error as Error).message,
      ip: req.ip
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

export default router;
