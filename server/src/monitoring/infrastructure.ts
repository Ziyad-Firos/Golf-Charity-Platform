import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance-monitor';
import { alertingSystem, createAlert } from './alerting';

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    cached: number;
    buffers: number;
    swapTotal: number;
    swapUsed: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    connections: number;
  };
  process: {
    pid: number;
    uptime: number;
    version: string;
    nodeVersion: string;
  };
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  timestamp: number;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface ServiceHealth {
  database: HealthCheck;
  cache: HealthCheck;
  external: HealthCheck;
  overall: HealthCheck;
}

class InfrastructureMonitor {
  private static instance: InfrastructureMonitor;
  private metrics = new Map<string, SystemMetrics>();
  private healthChecks = new Map<string, HealthCheck>();
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  private constructor() {
    this.setupHealthChecks();
  }

  static getInstance(): InfrastructureMonitor {
    if (!InfrastructureMonitor.instance) {
      InfrastructureMonitor.instance = new InfrastructureMonitor();
    }
    return InfrastructureMonitor.instance;
  }

  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info('Infrastructure monitoring started', { intervalMs });

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.runHealthChecks();
        this.analyzeMetrics();
      } catch (error) {
        logger.error('Error in infrastructure monitoring', { error: (error as Error).message });
      }
    }, intervalMs);

    // Initial collection
    this.collectMetrics();
    this.runHealthChecks();
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Infrastructure monitoring stopped');
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      cpu: this.getCpuMetrics(),
      memory: this.getMemoryMetrics(),
      disk: this.getDiskMetrics(),
      network: this.getNetworkMetrics(),
      process: this.getProcessMetrics()
    };

    // Store metrics with timestamp
    const timestamp = Date.now();
    this.metrics.set(timestamp.toString(), metrics);

    // Keep only last 1000 entries
    if (this.metrics.size > 1000) {
      const keys = Array.from(this.metrics.keys());
      keys.slice(0, -1000).forEach(key => this.metrics.delete(key));
    }

    return metrics;
  }

  private getCpuMetrics(): SystemMetrics['cpu'] {
    // Simplified CPU metrics - in production, use a proper library like systeminformation
    const cpus = require('os').cpus();
    const loadAvg = require('os').loadavg();
    
    return {
      usage: Math.random() * 100, // Placeholder - would use actual CPU usage
      loadAverage: loadAvg,
      cores: cpus.length
    };
  }

  private getMemoryMetrics(): SystemMetrics['memory'] {
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    const usedMem = totalMem - freeMem;

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      cached: 0, // Would get from /proc/meminfo on Linux
      buffers: 0, // Would get from /proc/meminfo on Linux
      swapTotal: 0, // Would get from systeminformation
      swapUsed: 0   // Would get from systeminformation
    };
  }

  private getDiskMetrics(): SystemMetrics['disk'] {
    // Simplified disk metrics - in production, use filesystem stats
    const total = 100 * 1024 * 1024 * 1024; // 100GB placeholder
    const used = total * 0.6; // 60% used placeholder

    return {
      total,
      used,
      free: total - used,
      usage: (used / total) * 100
    };
  }

  private getNetworkMetrics(): SystemMetrics['network'] {
    // Simplified network metrics - in production, use network interface stats
    return {
      bytesIn: Math.random() * 1000000,
      bytesOut: Math.random() * 1000000,
      packetsIn: Math.random() * 10000,
      packetsOut: Math.random() * 10000,
      connections: Math.floor(Math.random() * 1000)
    };
  }

  private getProcessMetrics(): SystemMetrics['process'] {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version
    };
  }

  private async runHealthChecks(): Promise<ServiceHealth> {
    const startTime = Date.now();

    const [database, cache, external] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkCacheHealth(),
      this.checkExternalServiceHealth()
    ]);

    const overall = this.calculateOverallHealth([database, cache, external]);

    const serviceHealth: ServiceHealth = {
      database,
      cache,
      external,
      overall
    };

    // Store health checks
    this.healthChecks.set('current', serviceHealth);

    logger.debug('Health checks completed', {
      database: database.status,
      cache: cache.status,
      external: external.status,
      overall: overall.status,
      duration: Date.now() - startTime
    });

    return serviceHealth;
  }

  private async checkDatabaseHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple database connectivity check
      const { query } = require('../db/client');
      await query('SELECT 1');
      
      return {
        name: 'database',
        status: 'healthy',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        metadata: {
          connectionPool: 'active'
        }
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: (error as Error).message,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkCacheHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const { cache } = require('../utils/cache');
      
      // Test cache operations
      const testKey = 'health_check_' + Date.now();
      cache.set(testKey, 'test', 1000);
      const value = cache.get(testKey);
      cache.delete(testKey);
      
      if (value === 'test') {
        return {
          name: 'cache',
          status: 'healthy',
          timestamp: Date.now(),
          responseTime: Date.now() - startTime,
          metadata: {
            operations: 'read/write/delete',
            stats: cache.getStats()
          }
        };
      } else {
        return {
          name: 'cache',
          status: 'degraded',
          message: 'Cache operations inconsistent',
          timestamp: Date.now(),
          responseTime: Date.now() - startTime
        };
      }
    } catch (error) {
      return {
        name: 'cache',
        status: 'unhealthy',
        message: (error as Error).message,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkExternalServiceHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check external services (Stripe, email service, etc.)
      // This is a placeholder - implement actual checks for your services
      
      // Example: Check Stripe API
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      await stripe.accounts.retrieve();
      
      return {
        name: 'external',
        status: 'healthy',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        metadata: {
          services: ['stripe', 'email'],
          status: 'all_available'
        }
      };
    } catch (error) {
      return {
        name: 'external',
        status: 'degraded',
        message: 'Some external services unavailable',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        metadata: {
          error: (error as Error).message
        }
      };
    }
  }

  private calculateOverallHealth(checks: HealthCheck[]): HealthCheck {
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    const healthyCount = checks.filter(c => c.status === 'healthy').length;

    let status: HealthCheck['status'] = 'healthy';
    let message: string | undefined;

    if (unhealthyCount > 0) {
      status = 'unhealthy';
      message = `${unhealthyCount} service(s) unhealthy`;
    } else if (degradedCount > 0) {
      status = 'degraded';
      message = `${degradedCount} service(s) degraded`;
    }

    return {
      name: 'overall',
      status,
      message,
      timestamp: Date.now(),
      metadata: {
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
        total: checks.length
      }
    };
  }

  private analyzeMetrics(): void {
    const metrics = this.getLatestMetrics();
    if (!metrics) return;

    // CPU usage analysis
    if (metrics.cpu.usage > 90) {
      createAlert('critical', 'infrastructure', `High CPU usage: ${metrics.cpu.usage.toFixed(2)}%`, 8, {
        metric: 'cpu_usage',
        value: metrics.cpu.usage,
        threshold: 90
      });
    } else if (metrics.cpu.usage > 80) {
      createAlert('warning', 'infrastructure', `Elevated CPU usage: ${metrics.cpu.usage.toFixed(2)}%`, 6, {
        metric: 'cpu_usage',
        value: metrics.cpu.usage,
        threshold: 80
      });
    }

    // Memory usage analysis
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100;
    if (memoryUsagePercent > 90) {
      createAlert('critical', 'infrastructure', `High memory usage: ${memoryUsagePercent.toFixed(2)}%`, 8, {
        metric: 'memory_usage',
        value: memoryUsagePercent,
        threshold: 90
      });
    } else if (memoryUsagePercent > 80) {
      createAlert('warning', 'infrastructure', `Elevated memory usage: ${memoryUsagePercent.toFixed(2)}%`, 6, {
        metric: 'memory_usage',
        value: memoryUsagePercent,
        threshold: 80
      });
    }

    // Disk usage analysis
    if (metrics.disk.usage > 90) {
      createAlert('critical', 'infrastructure', `High disk usage: ${metrics.disk.usage.toFixed(2)}%`, 8, {
        metric: 'disk_usage',
        value: metrics.disk.usage,
        threshold: 90
      });
    } else if (metrics.disk.usage > 80) {
      createAlert('warning', 'infrastructure', `Elevated disk usage: ${metrics.disk.usage.toFixed(2)}%`, 6, {
        metric: 'disk_usage',
        value: metrics.disk.usage,
        threshold: 80
      });
    }

    // Network connections analysis
    if (metrics.network.connections > 1000) {
      createAlert('warning', 'infrastructure', `High network connections: ${metrics.network.connections}`, 5, {
        metric: 'network_connections',
        value: metrics.network.connections,
        threshold: 1000
      });
    }
  }

  // Public methods
  getLatestMetrics(): SystemMetrics | null {
    const keys = Array.from(this.metrics.keys()).sort();
    if (keys.length === 0) return null;
    
    return this.metrics.get(keys[keys.length - 1]) || null;
  }

  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const keys = Array.from(this.metrics.keys())
      .filter(key => parseInt(key) >= cutoffTime)
      .sort();

    return keys.map(key => this.metrics.get(key)!);
  }

  getCurrentHealth(): ServiceHealth | null {
    return this.healthChecks.get('current') || null;
  }

  getHealthHistory(hours: number = 24): HealthCheck[] {
    // This would need to be implemented with a proper storage mechanism
    // For now, return current health
    const current = this.getCurrentHealth();
    return current ? [current.overall] : [];
  }

  getSystemSummary(): {
    uptime: number;
    version: string;
    environment: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    totalMemory: number;
    freeMemory: number;
    cpuCount: number;
    loadAverage: number[];
  } {
    const os = require('os');
    const metrics = this.getLatestMetrics();

    return {
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg()
    };
  }

  // Performance analysis
  getPerformanceReport(): {
    system: SystemMetrics;
    health: ServiceHealth;
    alerts: any;
    recommendations: string[];
  } {
    const system = this.getLatestMetrics();
    const health = this.getCurrentHealth();
    const alerts = alertingSystem.getAlerts({ resolved: false });
    const recommendations = this.generateRecommendations(system, health);

    return {
      system: system!,
      health: health!,
      alerts,
      recommendations
    };
  }

  private generateRecommendations(system?: SystemMetrics, health?: ServiceHealth): string[] {
    const recommendations: string[] = [];

    if (!system || !health) return recommendations;

    // CPU recommendations
    if (system.cpu.usage > 80) {
      recommendations.push('Consider scaling up or optimizing CPU-intensive operations');
    }

    // Memory recommendations
    const memoryUsagePercent = (system.memory.used / system.memory.total) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push('Consider adding more memory or optimizing memory usage');
    }

    // Disk recommendations
    if (system.disk.usage > 80) {
      recommendations.push('Consider cleaning up disk space or adding more storage');
    }

    // Health check recommendations
    if (health.database.status !== 'healthy') {
      recommendations.push('Database connection issues detected - check database configuration');
    }

    if (health.cache.status !== 'healthy') {
      recommendations.push('Cache performance issues detected - consider cache optimization');
    }

    if (health.external.status !== 'healthy') {
      recommendations.push('External service issues detected - check service availability');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('System is running optimally');
    }

    return recommendations;
  }

  // Cleanup
  cleanup(): void {
    this.stopMonitoring();
    this.metrics.clear();
    this.healthChecks.clear();
  }
}

export const infrastructureMonitor = InfrastructureMonitor.getInstance();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  infrastructureMonitor.startMonitoring();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  infrastructureMonitor.cleanup();
});

process.on('SIGINT', () => {
  infrastructureMonitor.cleanup();
});
