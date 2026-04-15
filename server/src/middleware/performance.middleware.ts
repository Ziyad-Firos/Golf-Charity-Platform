import { Request, Response, NextFunction } from 'express';
import { performanceMonitor } from '../utils/performance-monitor';
import { cache } from '../utils/cache';
import { logger } from '../utils/logger';

// Performance monitoring middleware
export const performanceTracking = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performanceMonitor.startTimer(`${req.method} ${req.path}`);
  
  // Track response time
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Record performance metrics
    performanceMonitor.endTimer(`${req.method} ${req.path}`, startTime, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode
      });
    }

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
};

// Response caching middleware
export const responseCache = (ttl: number = 5 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `response:${req.method}:${req.originalUrl}`;
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse) {
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-TTL', Math.max(0, ttl - (Date.now() - cachedResponse.timestamp)).toString());
      return res.json(cachedResponse.data);
    }
    
    // Override res.json to cache responses
    const originalJson = res.json;
    res.json = function (data: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        }, ttl);
        res.set('X-Cache', 'MISS');
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Database query optimization middleware
export const queryOptimization = (req: Request, res: Response, next: NextFunction): void => {
  // Add query optimization hints to request
  req.queryOptimization = {
    useIndex: true,
    limitResults: true,
    cacheResults: req.method === 'GET'
  };
  
  next();
};

// Request size limiting middleware
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'Request entity too large'
        }
      });
    }
    
    next();
  };
};

// Compression middleware (simplified version)
export const compression = (req: Request, res: Response, next: NextFunction): void => {
  const acceptEncoding = req.get('Accept-Encoding') || '';
  
  if (acceptEncoding.includes('gzip')) {
    res.set('Content-Encoding', 'gzip');
    // In production, use a proper compression library
  }
  
  next();
};

// Memory usage monitoring middleware
export const memoryMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const memUsage = process.memoryUsage();
  
  // Log memory usage if it's high
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    logger.warn('High memory usage detected', {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      url: req.url
    });
  }
  
  // Add memory usage to response headers for monitoring
  res.set('X-Memory-Usage', Math.round(memUsage.heapUsed / 1024 / 1024).toString());
  
  next();
};

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout'
          }
        });
      }
    }, timeoutMs);
    
    // Clear timeout when response is sent
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      clearTimeout(timeout);
      originalEnd.apply(res, args);
    };
    
    next();
  };
};

// Concurrent request limiting middleware
export const concurrentRequestLimit = (maxConcurrent: number = 100) => {
  let currentRequests = 0;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    currentRequests++;
    
    if (currentRequests > maxConcurrent) {
      currentRequests--;
      return res.status(429).json({
        error: {
          code: 'TOO_MANY_CONCURRENT_REQUESTS',
          message: 'Server is busy, please try again later'
        }
      });
    }
    
    // Decrement when request is done
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      currentRequests--;
      originalEnd.apply(res, args);
    };
    
    next();
  };
};

// Database connection pool monitoring
export const connectionPoolMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  // This would be implemented based on your database client
  // For now, just log the request
  logger.debug('Request received', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent')
  });
  
  next();
};

// API versioning middleware
export const apiVersioning = (supportedVersions: string[] = ['v1']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const version = req.get('API-Version') || req.headers['api-version'] || 'v1';
    
    if (!supportedVersions.includes(version)) {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_API_VERSION',
          message: `API version ${version} is not supported`,
          supportedVersions
        }
      });
    }
    
    req.apiVersion = version;
    res.set('API-Version', version);
    
    next();
  };
};

// Health check middleware
export const healthCheck = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === '/health' || req.path === '/api/health') {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };
    
    return res.json(health);
  }
  
  next();
};

// Request deduplication middleware
export const requestDeduplication = () => {
  const pendingRequests = new Map<string, Promise<any>>();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only deduplicate GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    
    if (pendingRequests.has(key)) {
      // Wait for the existing request to complete
      pendingRequests.get(key)!.then(
        (data) => res.json(data),
        (error) => res.status(500).json(error)
      );
      return;
    }
    
    // Create new request promise
    const promise = new Promise((resolve, reject) => {
      const originalJson = res.json;
      const originalStatus = res.status;
      
      res.json = function (data: any) {
        resolve(data);
        return originalJson.call(this, data);
      };
      
      res.status = function (code: number) {
        if (code >= 400) {
          reject(new Error(`HTTP ${code}`));
        }
        return originalStatus.call(this, code);
      };
    });
    
    pendingRequests.set(key, promise);
    
    // Clean up after request completes
    promise.finally(() => {
      pendingRequests.delete(key);
    });
    
    next();
  };
};

// Performance metrics collection
export const metricsCollection = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Collect metrics
    const metrics = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };
    
    // Store metrics (in production, use a proper metrics system)
    logger.debug('Request metrics', metrics);
  });
  
  next();
};

// Bundle all performance middleware
export const performanceMiddleware = [
  performanceTracking,
  memoryMonitoring,
  metricsCollection,
  connectionPoolMonitoring
];

// Bundle all optimization middleware
export const optimizationMiddleware = [
  requestSizeLimit(),
  requestTimeout(),
  concurrentRequestLimit(),
  compression,
  queryOptimization
];
