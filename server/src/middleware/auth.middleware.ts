import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/client';

type NextFunction = (err?: any) => void;

// Extend Express Request to carry the decoded user
declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        id: string;
        email: string;
        role: string;
      };
      ip?: string;
    }
    interface Response {
      cookie(name: string, value: string, options?: any): void;
      clearCookie(name: string, options?: any): void;
    }
  }
}

export interface AuthUser {
  sub: string;
  id: string;
  email: string;
  role: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export type AuthRequest = Request & {
  user: AuthUser;
};

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      error: { code: 'AUTH_INVALID_TOKEN', message: 'No authentication token provided' },
    });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Server configuration error' },
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = { sub: payload.sub, id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Authentication token has expired' },
      });
    } else {
      res.status(401).json({
        error: { code: 'AUTH_INVALID_TOKEN', message: 'Invalid authentication token' },
      });
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      error: { code: 'AUTH_FORBIDDEN', message: 'Administrator access required' },
    });
    return;
  }
  next();
}

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: { code: 'AUTH_INVALID_TOKEN', message: 'Authentication required' },
    });
    return;
  }

  try {
    const rows = await query<{ subscription_state: string }>(
      'SELECT subscription_state FROM subscribers WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0 || rows[0].subscription_state !== 'active') {
      res.status(403).json({
        error: { code: 'SUBSCRIPTION_INACTIVE', message: 'An active subscription is required to access this resource' },
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
}
