import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance-monitor';
import { cache } from '../utils/cache';

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'critical';
  source: string;
  message: string;
  timestamp: number;
  severity: number; // 1-10 scale
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean;
  threshold: number;
  severity: number;
  enabled: boolean;
  cooldownMs: number;
  lastTriggered?: number;
}

export interface MetricThreshold {
  name: string;
  warningThreshold: number;
  criticalThreshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  unit?: string;
}

class AlertingSystem {
  private static instance: AlertingSystem;
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private thresholds = new Map<string, MetricThreshold>();
  private subscribers = new Map<string, (alert: Alert) => void>();
  private cooldowns = new Map<string, number>();

  private constructor() {
    this.setupDefaultRules();
    this.setupDefaultThresholds();
    this.startMonitoring();
  }

  static getInstance(): AlertingSystem {
    if (!AlertingSystem.instance) {
      AlertingSystem.instance = new AlertingSystem();
    }
    return AlertingSystem.instance;
  }

  // Alert management
  createAlert(
    type: Alert['type'],
    source: string,
    message: string,
    severity: number,
    metadata?: Record<string, any>
  ): Alert {
    const alert: Alert = {
      id: this.generateId(),
      type,
      source,
      message,
      timestamp: Date.now(),
      severity,
      metadata,
      resolved: false
    };

    this.alerts.push(alert);
    this.notifySubscribers(alert);
    this.logAlert(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    return alert;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.notifySubscribers(alert);
      logger.info('Alert resolved', { alertId, source: alert.source });
      return true;
    }
    return false;
  }

  getAlerts(filter?: {
    type?: Alert['type'];
    source?: string;
    resolved?: boolean;
    from?: number;
    to?: number;
  }): Alert[] {
    let filtered = this.alerts;

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(a => a.type === filter.type);
      }
      if (filter.source) {
        filtered = filtered.filter(a => a.source === filter.source);
      }
      if (filter.resolved !== undefined) {
        filtered = filtered.filter(a => a.resolved === filter.resolved);
      }
      if (filter.from) {
        filtered = filtered.filter(a => a.timestamp >= filter.from!);
      }
      if (filter.to) {
        filtered = filtered.filter(a => a.timestamp <= filter.to!);
      }
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Rule management
  addRule(rule: Omit<AlertRule, 'id' | 'lastTriggered'>): void {
    const newRule: AlertRule = {
      ...rule,
      id: this.generateId(),
      lastTriggered: undefined
    };
    this.rules.push(newRule);
  }

  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
      return true;
    }
    return false;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
      return true;
    }
    return false;
  }

  // Threshold management
  setThreshold(name: string, threshold: MetricThreshold): void {
    this.thresholds.set(name, threshold);
  }

  getThreshold(name: string): MetricThreshold | undefined {
    return this.thresholds.get(name);
  }

  checkThreshold(name: string, value: number): Alert | null {
    const threshold = this.thresholds.get(name);
    if (!threshold) return null;

    let triggered = false;
    let severity = 5;

    switch (threshold.operator) {
      case 'gt':
        triggered = value > threshold.criticalThreshold;
        severity = 8;
        if (!triggered && value > threshold.warningThreshold) {
          triggered = true;
          severity = 5;
        }
        break;
      case 'lt':
        triggered = value < threshold.criticalThreshold;
        severity = 8;
        if (!triggered && value < threshold.warningThreshold) {
          triggered = true;
          severity = 5;
        }
        break;
      case 'gte':
        triggered = value >= threshold.criticalThreshold;
        severity = 8;
        if (!triggered && value >= threshold.warningThreshold) {
          triggered = true;
          severity = 5;
        }
        break;
      case 'lte':
        triggered = value <= threshold.criticalThreshold;
        severity = 8;
        if (!triggered && value <= threshold.warningThreshold) {
          triggered = true;
          severity = 5;
        }
        break;
      case 'eq':
        triggered = value === threshold.criticalThreshold;
        severity = 8;
        break;
    }

    if (triggered) {
      return this.createAlert(
        severity >= 7 ? 'critical' : 'warning',
        'threshold_monitor',
        `Threshold exceeded for ${name}: ${value}${threshold.unit || ''}`,
        severity,
        { threshold, value }
      );
    }

    return null;
  }

  // Subscription management
  subscribe(id: string, callback: (alert: Alert) => void): void {
    this.subscribers.set(id, callback);
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  // Monitoring methods
  private setupDefaultRules(): void {
    // High error rate
    this.addRule({
      name: 'High Error Rate',
      condition: (metrics) => {
        const stats = performanceMonitor.getStats();
        return stats.errorRate > 10; // 10% error rate
      },
      threshold: 10,
      severity: 7,
      enabled: true,
      cooldownMs: 5 * 60 * 1000 // 5 minutes
    });

    // Slow response time
    this.addRule({
      name: 'Slow Response Time',
      condition: (metrics) => {
        const stats = performanceMonitor.getStats();
        return stats.averageResponseTime > 2000; // 2 seconds
      },
      threshold: 2000,
      severity: 6,
      enabled: true,
      cooldownMs: 5 * 60 * 1000
    });

    // High memory usage
    this.addRule({
      name: 'High Memory Usage',
      condition: (metrics) => {
        const memUsage = process.memoryUsage();
        return memUsage.heapUsed > 1024 * 1024 * 1024; // 1GB
      },
      threshold: 1024 * 1024 * 1024,
      severity: 8,
      enabled: true,
      cooldownMs: 10 * 60 * 1000 // 10 minutes
    });

    // Low cache hit rate
    this.addRule({
      name: 'Low Cache Hit Rate',
      condition: (metrics) => {
        const stats = cache.getStats();
        return stats.hitRate < 50; // 50% hit rate
      },
      threshold: 50,
      severity: 5,
      enabled: true,
      cooldownMs: 15 * 60 * 1000 // 15 minutes
    });
  }

  private setupDefaultThresholds(): void {
    // Response time thresholds
    this.setThreshold('response_time', {
      name: 'response_time',
      warningThreshold: 1000, // 1 second
      criticalThreshold: 2000, // 2 seconds
      operator: 'gt',
      unit: 'ms'
    });

    // Error rate thresholds
    this.setThreshold('error_rate', {
      name: 'error_rate',
      warningThreshold: 5, // 5%
      criticalThreshold: 10, // 10%
      operator: 'gt',
      unit: '%'
    });

    // Memory usage thresholds
    this.setThreshold('memory_usage', {
      name: 'memory_usage',
      warningThreshold: 512 * 1024 * 1024, // 512MB
      criticalThreshold: 1024 * 1024 * 1024, // 1GB
      operator: 'gt',
      unit: 'bytes'
    });

    // CPU usage thresholds
    this.setThreshold('cpu_usage', {
      name: 'cpu_usage',
      warningThreshold: 70, // 70%
      criticalThreshold: 90, // 90%
      operator: 'gt',
      unit: '%'
    });

    // Cache hit rate thresholds
    this.setThreshold('cache_hit_rate', {
      name: 'cache_hit_rate',
      warningThreshold: 60, // 60%
      criticalThreshold: 40, // 40%
      operator: 'lt',
      unit: '%'
    });
  }

  private startMonitoring(): void {
    // Check rules every 30 seconds
    setInterval(() => {
      this.checkRules();
    }, 30000);

    // Check thresholds every 10 seconds
    setInterval(() => {
      this.checkThresholds();
    }, 10000);
  }

  private checkRules(): void {
    const metrics = this.collectMetrics();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered < rule.cooldownMs) {
        continue;
      }

      try {
        if (rule.condition(metrics)) {
          this.createAlert(
            rule.severity >= 7 ? 'critical' : 'warning',
            'rule_monitor',
            `Rule triggered: ${rule.name}`,
            rule.severity,
            { ruleId: rule.id, metrics }
          );
          rule.lastTriggered = Date.now();
        }
      } catch (error) {
        logger.error('Error checking rule', {
          ruleId: rule.id,
          error: (error as Error).message
        });
      }
    }
  }

  private checkThresholds(): void {
    const metrics = this.collectMetrics();

    for (const [name, threshold] of this.thresholds.entries()) {
      const value = this.getMetricValue(metrics, name);
      if (value !== undefined) {
        this.checkThreshold(name, value);
      }
    }
  }

  private collectMetrics(): any {
    const perfStats = performanceMonitor.getStats();
    const cacheStats = cache.getStats();
    const memUsage = process.memoryUsage();

    return {
      performance: perfStats,
      cache: cacheStats,
      memory: memUsage,
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }

  private getMetricValue(metrics: any, name: string): number | undefined {
    switch (name) {
      case 'response_time':
        return metrics.performance.averageResponseTime;
      case 'error_rate':
        return metrics.performance.errorRate;
      case 'memory_usage':
        return metrics.memory.heapUsed;
      case 'cpu_usage':
        return this.getCpuUsage(); // Would need implementation
      case 'cache_hit_rate':
        return metrics.cache.hitRate;
      default:
        return undefined;
    }
  }

  private getCpuUsage(): number {
    // Simplified CPU usage calculation
    // In production, use a proper CPU monitoring library
    return Math.random() * 100; // Placeholder
  }

  private notifySubscribers(alert: Alert): void {
    for (const [id, callback] of this.subscribers.entries()) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Error notifying subscriber', {
          subscriberId: id,
          error: (error as Error).message
        });
      }
    }
  }

  private logAlert(alert: Alert): void {
    const logData = {
      alertId: alert.id,
      type: alert.type,
      source: alert.source,
      message: alert.message,
      severity: alert.severity,
      metadata: alert.metadata
    };

    switch (alert.type) {
      case 'critical':
        logger.error('Critical alert', logData);
        break;
      case 'error':
        logger.error('Error alert', logData);
        break;
      case 'warning':
        logger.warn('Warning alert', logData);
        break;
      case 'info':
        logger.info('Info alert', logData);
        break;
    }
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Analytics and reporting
  getAlertStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    resolved: number;
    unresolved: number;
    averageResolutionTime: number;
  } {
    const alerts = this.alerts;
    const resolved = alerts.filter(a => a.resolved);
    const unresolved = alerts.filter(a => !a.resolved);

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const alert of alerts) {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity.toString()] = (bySeverity[alert.severity.toString()] || 0) + 1;
      bySource[alert.source] = (bySource[alert.source] || 0) + 1;
    }

    const averageResolutionTime = resolved.length > 0
      ? resolved.reduce((sum, alert) => sum + (alert.resolvedAt! - alert.timestamp), 0) / resolved.length
      : 0;

    return {
      total: alerts.length,
      byType,
      bySeverity,
      bySource,
      resolved: resolved.length,
      unresolved: unresolved.length,
      averageResolutionTime
    };
  }

  // Health check
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    alerts: {
      critical: number;
      warning: number;
      info: number;
    };
    uptime: number;
    lastAlert?: Alert;
  } {
    const criticalAlerts = this.alerts.filter(a => a.type === 'critical' && !a.resolved);
    const warningAlerts = this.alerts.filter(a => a.type === 'warning' && !a.resolved);
    const infoAlerts = this.alerts.filter(a => a.type === 'info' && !a.resolved);

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'warning';
    }

    const lastAlert = this.alerts.length > 0 ? this.alerts[this.alerts.length - 1] : undefined;

    return {
      status,
      alerts: {
        critical: criticalAlerts.length,
        warning: warningAlerts.length,
        info: infoAlerts.length
      },
      uptime: process.uptime(),
      lastAlert
    };
  }
}

export const alertingSystem = AlertingSystem.getInstance();

// Alert decorators
export function alertOnFailure(source: string, severity: number = 5) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        alertingSystem.createAlert(
          'error',
          source,
          `Method ${propertyKey} failed: ${(error as Error).message}`,
          severity,
          { error: (error as Error).message, stack: (error as Error).stack }
        );
        throw error;
      }
    };

    return descriptor;
  };
}

// Alert utilities
export const createAlert = (
  type: Alert['type'],
  source: string,
  message: string,
  severity: number,
  metadata?: Record<string, any>
): Alert => {
  return alertingSystem.createAlert(type, source, message, severity, metadata);
};

export const resolveAlert = (alertId: string): boolean => {
  return alertingSystem.resolveAlert(alertId);
};

export const getAlerts = (filter?: any): Alert[] => {
  return alertingSystem.getAlerts(filter);
};

export const subscribeToAlerts = (id: string, callback: (alert: Alert) => void): void => {
  alertingSystem.subscribe(id, callback);
};

export const unsubscribeFromAlerts = (id: string): void => {
  alertingSystem.unsubscribe(id);
};
