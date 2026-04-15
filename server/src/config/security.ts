import { config } from './index';

export interface SecurityConfig {
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    algorithm: string;
  };
  bcrypt: {
    rounds: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    authMaxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
    optionsSuccessStatus: number;
  };
  headers: {
    contentSecurityPolicy: string;
    frameOptions: string;
    contentTypeOptions: string;
    xssProtection: string;
    referrerPolicy: string;
    hsts: string;
  };
  encryption: {
    algorithm: string;
    keySize: number;
    ivSize: number;
  };
  session: {
    secret: string;
    resave: boolean;
    saveUninitialized: boolean;
    cookie: {
      secure: boolean;
      httpOnly: boolean;
      sameSite: string;
      maxAge: number;
    };
  };
  validation: {
    emailRegex: string;
    passwordRegex: string;
    nameRegex: string;
    maxStringLength: number;
  };
}

export const securityConfig: SecurityConfig = {
  jwt: {
    secret: config.get('JWT_SECRET'),
    refreshSecret: config.get('JWT_REFRESH_SECRET'),
    expiresIn: '15m',
    refreshExpiresIn: '7d',
    algorithm: 'HS256'
  },
  bcrypt: {
    rounds: 12
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    authMaxRequests: 5,
    skipSuccessfulRequests: false
  },
  cors: {
    origin: config.get('CLIENT_URL') || 'http://localhost:5173',
    credentials: true,
    optionsSuccessStatus: 204
  },
  headers: {
    contentSecurityPolicy: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; '),
    frameOptions: 'DENY',
    contentTypeOptions: 'nosniff',
    xssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin',
    hsts: config.get('NODE_ENV') === 'production' 
      ? 'max-age=31536000; includeSubDomains; preload' 
      : 'max-age=3600'
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keySize: 32,
    ivSize: 16
  },
  session: {
    secret: config.get('SESSION_SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.get('NODE_ENV') === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },
  validation: {
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    passwordRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    nameRegex: /^[a-zA-Z\s'-]{1,50}$/,
    maxStringLength: 1000
  }
};

// Security validation functions
export const validateEmail = (email: string): boolean => {
  return securityConfig.validation.emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  return securityConfig.validation.passwordRegex.test(password);
};

export const validateName = (name: string): boolean => {
  return securityConfig.validation.nameRegex.test(name);
};

export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:text\/html/gi, '') // Remove data URLs
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/onload=/gi, '') // Remove onload handlers
    .replace(/onerror=/gi, '') // Remove onerror handlers
    .trim()
    .substring(0, securityConfig.validation.maxStringLength);
};

export const generateSecureToken = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

export const generateCsrfToken = (): string => {
  return generateSecureToken(64);
};

export const hashPassword = async (password: string): Promise<string> => {
  const bcrypt = require('bcrypt');
  return bcrypt.hash(password, securityConfig.bcrypt.rounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  const bcrypt = require('bcrypt');
  return bcrypt.compare(password, hash);
};

export const generateJwtToken = (payload: any): string => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, securityConfig.jwt.secret, {
    expiresIn: securityConfig.jwt.expiresIn,
    algorithm: securityConfig.jwt.algorithm
  });
};

export const verifyJwtToken = (token: string): any => {
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, securityConfig.jwt.secret, {
    algorithms: [securityConfig.jwt.algorithm]
  });
};

export const generateRefreshToken = (payload: any): string => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, securityConfig.jwt.refreshSecret, {
    expiresIn: securityConfig.jwt.refreshExpiresIn,
    algorithm: securityConfig.jwt.algorithm
  });
};

export const verifyRefreshToken = (token: string): any => {
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, securityConfig.jwt.refreshSecret, {
    algorithms: [securityConfig.jwt.algorithm]
  });
};

// Rate limiting helpers
export const getRateLimitKey = (req: any): string => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  return `${ip}-${userAgent}`;
};

export const isRateLimited = (key: string, attempts: number, windowMs: number): boolean => {
  // This would typically use Redis or another store
  // For now, return false (implementation would depend on storage)
  return false;
};

// Security headers helper
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    'X-Frame-Options': securityConfig.headers.frameOptions,
    'X-Content-Type-Options': securityConfig.headers.contentTypeOptions,
    'X-XSS-Protection': securityConfig.headers.xssProtection,
    'Referrer-Policy': securityConfig.headers.referrerPolicy,
    'Content-Security-Policy': securityConfig.headers.contentSecurityPolicy,
    ...(config.get('NODE_ENV') === 'production' && {
      'Strict-Transport-Security': securityConfig.headers.hsts
    })
  };
};

// Input validation schemas
export const validationSchemas = {
  register: {
    email: {
      type: 'string',
      format: 'email',
      required: true,
      maxLength: 255
    },
    password: {
      type: 'string',
      required: true,
      minLength: 8,
      maxLength: 128,
      pattern: securityConfig.validation.passwordRegex
    },
    firstName: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 50,
      pattern: securityConfig.validation.nameRegex
    },
    lastName: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 50,
      pattern: securityConfig.validation.nameRegex
    }
  },
  login: {
    email: {
      type: 'string',
      format: 'email',
      required: true,
      maxLength: 255
    },
    password: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 128
    }
  }
};

// Security audit logging
export const logSecurityEvent = (event: string, details: any): void => {
  const logger = require('./logger').logger;
  
  logger.warn('Security event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Password strength checker
export const checkPasswordStrength = (password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} => {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Password should be at least 8 characters long');
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain at least one uppercase letter');
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain at least one lowercase letter');
  }

  // Number check
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain at least one number');
  }

  // Special character check
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain at least one special character');
  }

  // Common patterns check
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /admin/i,
    /letmein/i
  ];

  const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
  if (hasCommonPattern) {
    score -= 2;
    feedback.push('Password contains common patterns that are easy to guess');
  }

  return {
    score: Math.max(0, Math.min(5, score)),
    feedback,
    isStrong: score >= 4
  };
};

// IP whitelist/blacklist helpers
export const isIpWhitelisted = (ip: string, whitelist: string[]): boolean => {
  return whitelist.some(allowedIp => {
    if (allowedIp.includes('/')) {
      // CIDR notation (simplified)
      const [network, prefix] = allowedIp.split('/');
      // This is a simplified implementation - use a proper IP library in production
      return ip.startsWith(network);
    }
    return ip === allowedIp;
  });
};

export const isIpBlacklisted = (ip: string, blacklist: string[]): boolean => {
  return blacklist.some(blockedIp => {
    if (blockedIp.includes('/')) {
      // CIDR notation (simplified)
      const [network, prefix] = blockedIp.split('/');
      return ip.startsWith(network);
    }
    return ip === blockedIp;
  });
};

// Security configuration validation
export const validateSecurityConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!securityConfig.jwt.secret) {
    errors.push('JWT_SECRET is required');
  }

  if (!securityConfig.jwt.refreshSecret) {
    errors.push('JWT_REFRESH_SECRET is required');
  }

  if (securityConfig.jwt.secret.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters long');
  }

  if (securityConfig.jwt.refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET should be at least 32 characters long');
  }

  if (securityConfig.bcrypt.rounds < 10) {
    errors.push('Bcrypt rounds should be at least 10');
  }

  if (securityConfig.rateLimit.windowMs < 60000) {
    errors.push('Rate limit window should be at least 1 minute');
  }

  if (securityConfig.rateLimit.maxRequests < 10) {
    errors.push('Rate limit max requests should be at least 10');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
