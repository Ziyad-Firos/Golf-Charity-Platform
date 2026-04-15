import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import { logger } from '../utils/logger';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error: ValidationError) => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Validation failed', {
      errors: errorMessages,
      path: req.path,
      method: req.method,
      body: req.body,
      requestId: req.requestId
    });

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errorMessages
    });
    return;
  }
  
  next();
};

export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize request body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = (req.query[key] as string).trim();
      }
    });
  }

  next();
};

export const rateLimiter = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!requests.has(key)) {
      requests.set(key, []);
    }

    const userRequests = requests.get(key).filter((timestamp: number) => timestamp > windowStart);
    
    if (userRequests.length >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: key,
        requests: userRequests.length,
        path: req.path,
        requestId: req.requestId
      });

      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later'
      });
      return;
    }

    userRequests.push(now);
    requests.set(key, userRequests);
    
    next();
  };
};
