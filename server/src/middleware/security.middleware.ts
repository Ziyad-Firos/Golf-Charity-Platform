import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// Enhanced rate limiting for sensitive endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many attempts, please try again later' }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP + user agent for better rate limiting
    return `${req.ip}-${req.get('User-Agent')}`;
  },
  onLimitReached: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method
    });
  }
});

// Less restrictive rate limiting for general endpoints
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Recursive sanitization function
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        sanitized[key] = value
          .replace(/[<>]/g, '') // Remove HTML tags
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+=/gi, '') // Remove event handlers
          .trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
  
  // HSTS (HTTP Strict Transport Security)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

// Request validation middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /data:text\/html/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  const suspicious = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);

  if (suspicious) {
    logger.warn('Suspicious request detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body,
      query: req.query,
      params: req.params
    });

    res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Invalid request detected' }
    });
    return;
  }

  next();
};

// IP blocking middleware for repeated violations
const blockedIPs = new Set<string>();
const violationCounts = new Map<string, number>();

export const ipBlocker = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.connection.remoteAddress || '';

  if (blockedIPs.has(ip)) {
    logger.warn('Blocked IP attempted access', { ip });
    res.status(403).json({
      error: { code: 'IP_BLOCKED', message: 'Access denied' }
    });
    return;
  }

  next();
};

// Track violations for IP blocking
export const trackViolation = (req: Request, violation: string): void => {
  const ip = req.ip || req.connection.remoteAddress || '';
  const currentCount = violationCounts.get(ip) || 0;
  
  violationCounts.set(ip, currentCount + 1);
  
  logger.warn('Security violation tracked', {
    ip,
    violation,
    count: currentCount + 1
  });

  // Block IP after 10 violations
  if (currentCount + 1 >= 10) {
    blockedIPs.add(ip);
    logger.warn('IP blocked due to repeated violations', { ip });
  }

  // Clean up old entries (simple cleanup - in production, use a proper cache)
  if (Math.random() < 0.01) { // 1% chance to cleanup
    const now = Date.now();
    for (const [ip, count] of violationCounts.entries()) {
      if (count === 0 && now % 1000000 < 1000) { // Simple cleanup logic
        violationCounts.delete(ip);
      }
    }
  }
};

// CSRF protection middleware (simplified version)
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF for GET requests and authenticated endpoints
  if (req.method === 'GET' || req.path.startsWith('/api/auth/')) {
    return next();
  }

  const csrfToken = req.get('X-CSRF-Token');
  const sessionToken = req.session?.csrfToken;

  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      method: req.method,
      path: req.path
    });

    res.status(403).json({
      error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' }
    });
    return;
  }

  next();
};

// Content type validation
export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      logger.warn('Invalid content type', {
        ip: req.ip,
        method: req.method,
        contentType
      });

      res.status(400).json({
        error: { code: 'INVALID_CONTENT_TYPE', message: 'Content-Type must be application/json' }
      });
      return;
    }
  }

  next();
};
