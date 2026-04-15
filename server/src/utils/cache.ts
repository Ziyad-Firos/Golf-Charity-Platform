import { logger } from './logger';

interface CacheItem<T> {
  value: T;
  expiry: number;
  hits: number;
  lastAccessed: number;
}

interface CacheStats {
  totalItems: number;
  hitRate: number;
  missRate: number;
  memoryUsage: number;
  oldestItem: number;
  newestItem: number;
}

class MemoryCache {
  private static instance: MemoryCache;
  private cache = new Map<string, CacheItem<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxItems = 1000;
  private cleanupInterval = 60 * 1000; // 1 minute

  private constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  static getInstance(): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache();
    }
    return MemoryCache.instance;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    
    // Remove oldest item if cache is full
    if (this.cache.size >= this.maxItems) {
      const oldestKey = this.getOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.deletes++;
      }
    }

    this.cache.set(key, {
      value,
      expiry,
      hits: 0,
      lastAccessed: Date.now()
    });

    this.stats.sets++;
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.stats.deletes++;
      this.stats.misses++;
      return null;
    }

    item.hits++;
    item.lastAccessed = Date.now();
    this.stats.hits++;
    
    return item.value as T;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;
    
    let oldestItem = 0;
    let newestItem = 0;
    
    if (this.cache.size > 0) {
      const items = Array.from(this.cache.values());
      oldestItem = Math.min(...items.map(item => item.lastAccessed));
      newestItem = Math.max(...items.map(item => item.lastAccessed));
    }

    return {
      totalItems: this.cache.size,
      hitRate,
      missRate,
      memoryUsage: this.estimateMemoryUsage(),
      oldestItem,
      newestItem
    };
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug('Cache cleanup completed', {
        cleanedCount,
        remainingItems: this.cache.size
      });
    }
  }

  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    let totalSize = 0;
    
    for (const [key, item] of this.cache.entries()) {
      // Key size
      totalSize += key.length * 2; // UTF-16
      
      // Value size (rough estimation)
      const valueStr = JSON.stringify(item.value);
      totalSize += valueStr.length * 2;
      
      // Metadata size
      totalSize += 64; // Rough estimation for timestamps and counters
    }
    
    return totalSize;
  }
}

export const cache = MemoryCache.getInstance();

// Cache decorators for functions
export function cached<T extends (...args: any[]) => any>(
  ttl?: number,
  keyGenerator?: (...args: Parameters<T>) => string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: Parameters<T>) {
      const cacheKey = keyGenerator 
        ? keyGenerator(...args)
        : `${target.constructor.name}.${propertyKey}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cachedResult = cache.get<T>(cacheKey);
      if (cachedResult !== null) {
        return cachedResult;
      }
      
      // Execute original method
      const result = originalMethod.apply(this, args);
      
      // Handle promises
      if (result instanceof Promise) {
        return result.then((value: T) => {
          cache.set(cacheKey, value, ttl);
          return value;
        });
      }
      
      // Cache synchronous result
      cache.set(cacheKey, result, ttl);
      return result;
    };
    
    return descriptor;
  };
}

// Cache utility functions
export const cacheMiddleware = (ttl?: number) => {
  return (req: any, res: any, next: any) => {
    const cacheKey = `route:${req.method}:${req.originalUrl}`;
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedResponse);
    }
    
    // Override res.json to cache responses
    const originalJson = res.json;
    res.json = function (data: any) {
      cache.set(cacheKey, data, ttl);
      res.set('X-Cache', 'MISS');
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Database query caching
export const cachedQuery = async <T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  const result = await queryFn();
  cache.set(key, result, ttl);
  return result;
};

// Session caching
export class SessionCache {
  private static instance: SessionCache;
  private cache = new Map<string, any>();
  private defaultTTL = 24 * 60 * 60 * 1000; // 24 hours

  static getInstance(): SessionCache {
    if (!SessionCache.instance) {
      SessionCache.instance = new SessionCache();
    }
    return SessionCache.instance;
  }

  set(sessionId: string, data: any, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(sessionId, { data, expiry });
  }

  get(sessionId: string): any | null {
    const item = this.cache.get(sessionId);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(sessionId);
      return null;
    }
    
    return item.data;
  }

  delete(sessionId: string): boolean {
    return this.cache.delete(sessionId);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const sessionCache = SessionCache.getInstance();

// Cache warming utilities
export class CacheWarmer {
  private static instance: CacheWarmer;
  private warmupTasks = new Map<string, () => Promise<any>>();

  static getInstance(): CacheWarmer {
    if (!CacheWarmer.instance) {
      CacheWarmer.instance = new CacheWarmer();
    }
    return CacheWarmer.instance;
  }

  register(key: string, warmupFn: () => Promise<any>): void {
    this.warmupTasks.set(key, warmupFn);
  }

  async warmup(key?: string): Promise<void> {
    if (key) {
      const warmupFn = this.warmupTasks.get(key);
      if (warmupFn) {
        try {
          await warmupFn();
          logger.info('Cache warmed for key', { key });
        } catch (error) {
          logger.error('Failed to warm cache', { key, error: (error as Error).message });
        }
      }
    } else {
      // Warm up all registered keys
      for (const [key, warmupFn] of this.warmupTasks.entries()) {
        try {
          await warmupFn();
          logger.debug('Cache warmed for key', { key });
        } catch (error) {
          logger.error('Failed to warm cache', { key, error: (error as Error).message });
        }
      }
    }
  }

  async warmupAll(): Promise<void> {
    const promises = Array.from(this.warmupTasks.entries()).map(async ([key, warmupFn]) => {
      try {
        await warmupFn();
        logger.debug('Cache warmed for key', { key });
      } catch (error) {
        logger.error('Failed to warm cache', { key, error: (error as Error).message });
      }
    });

    await Promise.all(promises);
    logger.info('Cache warmup completed', { totalTasks: this.warmupTasks.size });
  }
}

export const cacheWarmer = CacheWarmer.getInstance();

// Cache invalidation utilities
export class CacheInvalidator {
  private static instance: CacheInvalidator;
  private patterns = new Map<string, RegExp>();

  static getInstance(): CacheInvalidator {
    if (!CacheInvalidator.instance) {
      CacheInvalidator.instance = new CacheInvalidator();
    }
    return CacheInvalidator.instance;
  }

  registerPattern(name: string, pattern: RegExp): void {
    this.patterns.set(name, pattern);
  }

  invalidateByPattern(patternName: string): number {
    const pattern = this.patterns.get(patternName);
    if (!pattern) return 0;

    let invalidatedCount = 0;
    const keys = cache.keys();

    for (const key of keys) {
      if (pattern.test(key)) {
        cache.delete(key);
        invalidatedCount++;
      }
    }

    logger.info('Cache invalidated by pattern', {
      patternName,
      invalidatedCount
    });

    return invalidatedCount;
  }

  invalidateByPrefix(prefix: string): number {
    let invalidatedCount = 0;
    const keys = cache.keys();

    for (const key of keys) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
        invalidatedCount++;
      }
    }

    logger.info('Cache invalidated by prefix', {
      prefix,
      invalidatedCount
    });

    return invalidatedCount;
  }
}

export const cacheInvalidator = CacheInvalidator.getInstance();
