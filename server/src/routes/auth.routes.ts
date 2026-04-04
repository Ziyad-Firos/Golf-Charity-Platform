import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/client';
import { authenticateToken } from '../middleware/auth.middleware';

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
  password_hash: string;
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

function setRefreshCookie(res: any, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/auth',
  });
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('A valid email address is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().withMessage('First name is required').trim(),
    body('lastName').notEmpty().withMessage('Last name is required').trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
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
    } catch {
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Invalid credentials').normalizeEmail(),
    body('password').notEmpty().withMessage('Invalid credentials'),
  ],
  async (req: Request, res: Response): Promise<void> => {
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
      const hashToCompare = subscriber ? subscriber.password_hash : DUMMY_HASH;

      const match = await bcrypt.compare(password, hashToCompare);

      if (!subscriber || !match) {
        res.status(401).json({
          error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' },
        });
        return;
      }

      const accessToken = issueAccessToken({ sub: subscriber.id, email: subscriber.email, role: subscriber.role });
      const refreshToken = issueRefreshToken({ sub: subscriber.id });

      setRefreshCookie(res, refreshToken);

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
    } catch {
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      });
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token: string | undefined = req.cookies?.refresh_token;

  if (!token) {
    res.status(401).json({
      error: { code: 'AUTH_INVALID_TOKEN', message: 'No refresh token provided' },
    });
    return;
  }

  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server configuration error' } });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { sub: string };

    const rows = await query<SubscriberRow>(
      'SELECT id, email, role FROM subscribers WHERE id = $1',
      [payload.sub]
    );

    if (rows.length === 0) {
      res.status(401).json({
        error: { code: 'AUTH_INVALID_TOKEN', message: 'Invalid refresh token' },
      });
      return;
    }

    const subscriber = rows[0];
    const accessToken = issueAccessToken({ sub: subscriber.id, email: subscriber.email, role: subscriber.role });

    res.json({ accessToken });
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Refresh token has expired' },
      });
    } else {
      res.status(401).json({
        error: { code: 'AUTH_INVALID_TOKEN', message: 'Invalid refresh token' },
      });
    }
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response): void => {
  (res as any).clearCookie('refresh_token', { path: '/api/auth' });
  res.status(200).json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await query<SubscriberRow>(
      'SELECT id, email, first_name, last_name, role, subscription_state FROM subscribers WHERE id = $1',
      [req.user!.id]
    );

    if (rows.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Subscriber not found' },
      });
      return;
    }

    const s = rows[0];
    res.json({
      user: {
        id: s.id,
        email: s.email,
        firstName: s.first_name,
        lastName: s.last_name,
        role: s.role,
        subscriptionState: s.subscription_state,
      },
    });
  } catch {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

export default router;
