import { performance } from 'perf_hooks';
import { logger } from './logger';

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  totalRequests: number;
  averageResponseTime: number;
  slowestRequest: number;
  fastestRequest: number;
  errorRate: number;
  requestsPerSecond: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private slowThreshold: number = 1000; // 1 second

  private constructor() {
    // Clean up old metrics periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(name: string): number {
    return performance.now();
  }

  endTimer(name: string, startTime: number, metadata?: Record<string, any>): void {
    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);
    this.requestCount++;

    if (duration > this.slowThreshold) {
      logger.warn('Slow request detected', {
        name,
        duration,
        metadata,
        threshold: this.slowThreshold
      });
    }

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  recordError(name: string, error: Error, metadata?: Record<string, any>): void {
    this.errorCount++;
    
    logger.error('Request error recorded', {
      name,
      error: error.message,
      stack: error.stack,
      metadata
    });
  }

  getStats(): PerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowestRequest: 0,
        fastestRequest: 0,
        errorRate: 0,
        requestsPerSecond: 0
      };
    }

    const durations = this.metrics.map(m => m.duration);
    const totalTime = durations.reduce((sum, duration) => sum + duration, 0);
    const averageResponseTime = totalTime / durations.length;
    const slowestRequest = Math.max(...durations);
    const fastestRequest = Math.min(...durations);
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    const uptime = Date.now() - this.startTime;
    const requestsPerSecond = uptime > 0 ? (this.requestCount / (uptime / 1000)) : 0;

    return {
      totalRequests: this.requestCount,
      averageResponseTime,
      slowestRequest,
      fastestRequest,
      errorRate,
      requestsPerSecond
    };
  }

  getSlowRequests(threshold: number = this.slowThreshold): PerformanceMetric[] {
    return this.metrics.filter(m => m.duration > threshold);
  }

  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name);
  }

  getMetricsInTimeRange(startTime: number, endTime: number): PerformanceMetric[] {
    return this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  private cleanup(): void {
    const cutoffTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago
    const beforeCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
    
    const cleanedCount = beforeCount - this.metrics.length;
    if (cleanedCount > 0) {
      logger.debug('Cleaned up old performance metrics', {
        cleanedCount,
        remainingCount: this.metrics.length
      });
    }
  }

  reset(): void {
    this.metrics = [];
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    
    logger.info('Performance metrics reset');
  }

  // Middleware for automatic tracking
  middleware(name: string) {
    return (req: any, res: any, next: any) => {
      const startTime = this.startTimer(name);
      
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Record the metric
        PerformanceMonitor.getInstance().endTimer(name, startTime, {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });

        // Call original end function
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // Database query monitoring
  monitorQuery(query: string, params?: any[]) {
    const startTime = this.startTimer('database_query');
    
    return {
      end: (error?: Error) => {
        if (error) {
          this.recordError('database_query', error, { query, params });
        }
        
        return this.endTimer('database_query', startTime, {
          query: query.substring(0, 100), // First 100 chars
          paramCount: params?.length || 0
        });
      }
    };
  }

  // Memory usage monitoring
  getMemoryUsage(): any {
    const usage = process.memoryUsage();
    
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      rssMB: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100
    };
  }

  // CPU usage monitoring
  getCpuUsage(): any {
    const usage = process.cpuUsage();
    
    return {
      user: usage.user,
      system: usage.system,
      userMS: usage.user / 1000,
      systemMS: usage.system / 1000
    };
  }

  // Generate performance report
  generateReport(): any {
    const stats = this.getStats();
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.getCpuUsage();
    const slowRequests = this.getSlowRequests();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      stats,
      memoryUsage,
      cpuUsage,
      slowRequests: slowRequests.slice(0, 10), // Top 10 slowest
      topEndpoints: this.getTopEndpoints(),
      errorBreakdown: this.getErrorBreakdown()
    };
  }

  private getTopEndpoints(): any[] {
    const endpointStats = new Map<string, { count: number; totalDuration: number; errors: number }>();
    
    this.metrics.forEach(metric => {
      const key = metric.name;
      const existing = endpointStats.get(key) || { count: 0, totalDuration: 0, errors: 0 };
      
      endpointStats.set(key, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + metric.duration,
        errors: existing.errors + (metric.metadata?.statusCode >= 400 ? 1 : 0)
      });
    });

    return Array.from(endpointStats.entries())
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        averageDuration: stats.totalDuration / stats.count,
        errorRate: (stats.errors / stats.count) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getErrorBreakdown(): any {
    const errors = new Map<string, number>();
    
    this.metrics
      .filter(m => m.metadata?.statusCode >= 400)
      .forEach(metric => {
        const statusCode = metric.metadata?.statusCode;
        const count = errors.get(statusCode) || 0;
        errors.set(statusCode, count + 1);
      });

    return Object.fromEntries(errors);
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// Decorator for automatic function performance monitoring
export function trackPerformance(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = performanceMonitor.startTimer(methodName);
      
      try {
        const result = await originalMethod.apply(this, args);
        
        performanceMonitor.endTimer(methodName, startTime, {
          argsCount: args.length,
          success: true
        });
        
        return result;
      } catch (error) {
        performanceMonitor.recordError(methodName, error as Error, {
          argsCount: args.length,
          success: false
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}
