import { logger } from '../utils/logger';
import { query } from '../db/client';

export interface BusinessMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface KPIData {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  totalRevenue: number;
  averageRevenuePerUser: number;
  subscriptionConversionRate: number;
  churnRate: number;
  customerLifetimeValue: number;
  averageSessionDuration: number;
  bounceRate: number;
  userGrowthRate: number;
}

export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  userRetentionRate: number;
  userEngagementScore: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  averageRevenuePerUser: number;
  revenueGrowthRate: number;
  revenueByPlan: Record<string, number>;
  revenueByCharity: Record<string, number>;
}

export interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  conversionRate: number;
  churnRate: number;
  averageSubscriptionLength: number;
  subscriptionByPlan: Record<string, number>;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  uptime: number;
  errorRate: number;
  throughput: number;
  userSatisfactionScore: number;
}

class BusinessMetricsTracker {
  private static instance: BusinessMetricsTracker;
  private metrics = new Map<string, BusinessMetric[]>();
  private kpiCache = new Map<string, any>();
  private lastUpdated = new Map<string, number>();

  private constructor() {
    this.startPeriodicUpdates();
  }

  static getInstance(): BusinessMetricsTracker {
    if (!BusinessMetricsTracker.instance) {
      BusinessMetricsTracker.instance = new BusinessMetricsTracker();
    }
    return BusinessMetricsTracker.instance;
  }

  // Metric recording
  recordMetric(name: string, value: number, unit: string, metadata?: Record<string, any>): void {
    const metric: BusinessMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      metadata
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only last 1000 metrics per type
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    logger.debug('Business metric recorded', { name, value, unit });
  }

  // User metrics
  async getUserMetrics(timeRange: 'day' | 'week' | 'month' = 'day'): Promise<UserMetrics> {
    const cacheKey = `user_metrics_${timeRange}`;
    const now = Date.now();
    
    if (this.kpiCache.has(cacheKey) && 
        now - this.lastUpdated.get(cacheKey)! < 5 * 60 * 1000) { // 5 minutes cache
      return this.kpiCache.get(cacheKey);
    }

    const timeCondition = this.getTimeCondition(timeRange);
    
    try {
      const [totalUsers, activeUsers, newUsers, returningUsers] = await Promise.all([
        query<{ count: string }>('SELECT COUNT(*) as count FROM subscribers'),
        query<{ count: string }>(`
          SELECT COUNT(DISTINCT s.id) as count 
          FROM subscribers s 
          JOIN subscription_events se ON s.id = se.subscriber_id 
          WHERE se.created_at >= ${timeCondition}
        `),
        query<{ count: string }>(`
          SELECT COUNT(*) as count 
          FROM subscribers 
          WHERE created_at >= ${timeCondition}
        `),
        query<{ count: string }>(`
          SELECT COUNT(DISTINCT s.id) as count 
          FROM subscribers s 
          JOIN subscription_events se ON s.id = se.subscriber_id 
          WHERE se.created_at >= ${timeCondition} 
          AND s.created_at < ${timeCondition}
        `)
      ]);

      const total = parseInt(totalUsers[0].count);
      const active = parseInt(activeUsers[0].count);
      const new = parseInt(newUsers[0].count);
      const returning = parseInt(returningUsers[0].count);

      const userRetentionRate = total > 0 ? (returning / (total - new)) * 100 : 0;
      const userEngagementScore = this.calculateEngagementScore(active, total);

      const metrics: UserMetrics = {
        totalUsers: total,
        activeUsers: active,
        newUsers: new,
        returningUsers: returning,
        userRetentionRate,
        userEngagementScore
      };

      this.kpiCache.set(cacheKey, metrics);
      this.lastUpdated.set(cacheKey, now);

      return metrics;
    } catch (error) {
      logger.error('Failed to get user metrics', { error: (error as Error).message });
      throw error;
    }
  }

  // Revenue metrics
  async getRevenueMetrics(timeRange: 'day' | 'week' | 'month' = 'month'): Promise<RevenueMetrics> {
    const cacheKey = `revenue_metrics_${timeRange}`;
    const now = Date.now();
    
    if (this.kpiCache.has(cacheKey) && 
        now - this.lastUpdated.get(cacheKey)! < 5 * 60 * 1000) {
      return this.kpiCache.get(cacheKey);
    }

    const timeCondition = this.getTimeCondition(timeRange);
    
    try {
      const [totalRevenue, mrr, revenueByPlan, revenueByCharity] = await Promise.all([
        query<{ sum: string }>(`
          SELECT COALESCE(SUM(amount), 0) as sum 
          FROM payments 
          WHERE created_at >= ${timeCondition} 
          AND status = 'completed'
        `),
        query<{ sum: string }>(`
          SELECT COALESCE(SUM(amount), 0) as sum 
          FROM subscriptions 
          WHERE state = 'active'
        `),
        query<{ plan_name: string; sum: string }>(`
          SELECT p.name as plan_name, COALESCE(SUM(s.amount), 0) as sum 
          FROM subscriptions s 
          JOIN plans p ON s.plan_id = p.id 
          WHERE s.state = 'active' 
          GROUP BY p.name
        `),
        query<{ charity_name: string; sum: string }>(`
          SELECT c.name as charity_name, COALESCE(SUM(sc.amount), 0) as sum 
          FROM subscription_charities sc 
          JOIN charities c ON sc.charity_id = c.id 
          WHERE sc.created_at >= ${timeCondition} 
          GROUP BY c.name
        `)
      ]);

      const total = parseFloat(totalRevenue[0].sum || '0');
      const monthly = parseFloat(mrr[0].sum || '0');
      
      const revenueByPlanMap: Record<string, number> = {};
      revenueByPlan.forEach(row => {
        revenueByPlanMap[row.plan_name] = parseFloat(row.sum || '0');
      });

      const revenueByCharityMap: Record<string, number> = {};
      revenueByCharity.forEach(row => {
        revenueByCharityMap[row.charity_name] = parseFloat(row.sum || '0');
      });

      const userMetrics = await this.getUserMetrics('month');
      const arpu = userMetrics.activeUsers > 0 ? total / userMetrics.activeUsers : 0;
      const revenueGrowthRate = this.calculateGrowthRate('revenue', timeRange);

      const metrics: RevenueMetrics = {
        totalRevenue: total,
        monthlyRecurringRevenue: monthly,
        averageRevenuePerUser: arpu,
        revenueGrowthRate,
        revenueByPlan: revenueByPlanMap,
        revenueByCharity: revenueByCharityMap
      };

      this.kpiCache.set(cacheKey, metrics);
      this.lastUpdated.set(cacheKey, now);

      return metrics;
    } catch (error) {
      logger.error('Failed to get revenue metrics', { error: (error as Error).message });
      throw error;
    }
  }

  // Subscription metrics
  async getSubscriptionMetrics(timeRange: 'day' | 'week' | 'month' = 'month'): Promise<SubscriptionMetrics> {
    const cacheKey = `subscription_metrics_${timeRange}`;
    const now = Date.now();
    
    if (this.kpiCache.has(cacheKey) && 
        now - this.lastUpdated.get(cacheKey)! < 5 * 60 * 1000) {
      return this.kpiCache.get(cacheKey);
    }

    const timeCondition = this.getTimeCondition(timeRange);
    
    try {
      const [total, active, cancelled, byPlan] = await Promise.all([
        query<{ count: string }>('SELECT COUNT(*) as count FROM subscriptions'),
        query<{ count: string }>('SELECT COUNT(*) as count FROM subscriptions WHERE state = \'active\''),
        query<{ count: string }>(`
          SELECT COUNT(*) as count 
          FROM subscriptions 
          WHERE state = 'cancelled' 
          AND updated_at >= ${timeCondition}
        `),
        query<{ plan_name: string; count: string }>(`
          SELECT p.name as plan_name, COUNT(*) as count 
          FROM subscriptions s 
          JOIN plans p ON s.plan_id = p.id 
          GROUP BY p.name
        `)
      ]);

      const totalSubs = parseInt(total[0].count);
      const activeSubs = parseInt(active[0].count);
      const cancelledSubs = parseInt(cancelled[0].count);

      const subscriptionByPlan: Record<string, number> = {};
      byPlan.forEach(row => {
        subscriptionByPlan[row.plan_name] = parseInt(row.count);
      });

      const conversionRate = this.calculateConversionRate(timeRange);
      const churnRate = activeSubs > 0 ? (cancelledSubs / activeSubs) * 100 : 0;
      const averageSubscriptionLength = await this.calculateAverageSubscriptionLength();

      const metrics: SubscriptionMetrics = {
        totalSubscriptions: totalSubs,
        activeSubscriptions: activeSubs,
        cancelledSubscriptions: cancelledSubs,
        conversionRate,
        churnRate,
        averageSubscriptionLength,
        subscriptionByPlan
      };

      this.kpiCache.set(cacheKey, metrics);
      this.lastUpdated.set(cacheKey, now);

      return metrics;
    } catch (error) {
      logger.error('Failed to get subscription metrics', { error: (error as Error).message });
      throw error;
    }
  }

  // Performance metrics
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cacheKey = 'performance_metrics';
    const now = Date.now();
    
    if (this.kpiCache.has(cacheKey) && 
        now - this.lastUpdated.get(cacheKey)! < 5 * 60 * 1000) {
      return this.kpiCache.get(cacheKey);
    }

    try {
      // These would typically come from your performance monitoring system
      const averageResponseTime = this.getAverageResponseTime();
      const uptime = process.uptime();
      const errorRate = this.getErrorRate();
      const throughput = this.getThroughput();
      const userSatisfactionScore = await this.calculateUserSatisfactionScore();

      const metrics: PerformanceMetrics = {
        averageResponseTime,
        uptime,
        errorRate,
        throughput,
        userSatisfactionScore
      };

      this.kpiCache.set(cacheKey, metrics);
      this.lastUpdated.set(cacheKey, now);

      return metrics;
    } catch (error) {
      logger.error('Failed to get performance metrics', { error: (error as Error).message });
      throw error;
    }
  }

  // Comprehensive KPI dashboard
  async getKPIDashboard(): Promise<KPIData> {
    const cacheKey = 'kpi_dashboard';
    const now = Date.now();
    
    if (this.kpiCache.has(cacheKey) && 
        now - this.lastUpdated.get(cacheKey)! < 10 * 60 * 1000) { // 10 minutes cache
      return this.kpiCache.get(cacheKey);
    }

    try {
      const [userMetrics, revenueMetrics, subscriptionMetrics] = await Promise.all([
        this.getUserMetrics('month'),
        this.getRevenueMetrics('month'),
        this.getSubscriptionMetrics('month')
      ]);

      const kpiData: KPIData = {
        dailyActiveUsers: await this.getActiveUsers('day'),
        weeklyActiveUsers: await this.getActiveUsers('week'),
        monthlyActiveUsers: userMetrics.activeUsers,
        totalRevenue: revenueMetrics.totalRevenue,
        averageRevenuePerUser: revenueMetrics.averageRevenuePerUser,
        subscriptionConversionRate: subscriptionMetrics.conversionRate,
        churnRate: subscriptionMetrics.churnRate,
        customerLifetimeValue: this.calculateCLV(revenueMetrics, subscriptionMetrics),
        averageSessionDuration: this.getAverageSessionDuration(),
        bounceRate: this.getBounceRate(),
        userGrowthRate: this.calculateGrowthRate('users', 'month')
      };

      this.kpiCache.set(cacheKey, kpiData);
      this.lastUpdated.set(cacheKey, now);

      return kpiData;
    } catch (error) {
      logger.error('Failed to get KPI dashboard', { error: (error as Error).message });
      throw error;
    }
  }

  // Utility methods
  private getTimeCondition(timeRange: 'day' | 'week' | 'month'): string {
    const now = new Date();
    let fromDate: Date;

    switch (timeRange) {
      case 'day':
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    return `'${fromDate.toISOString()}'`;
  }

  private calculateEngagementScore(activeUsers: number, totalUsers: number): number {
    if (totalUsers === 0) return 0;
    return (activeUsers / totalUsers) * 100;
  }

  private calculateGrowthRate(metric: string, timeRange: 'day' | 'week' | 'month'): number {
    // This would compare current period with previous period
    // Simplified implementation
    return Math.random() * 20 - 10; // Placeholder: -10% to +10%
  }

  private calculateConversionRate(timeRange: 'day' | 'week' | 'month'): number {
    // This would calculate the rate of users who convert to paid subscriptions
    return Math.random() * 15 + 5; // Placeholder: 5% to 20%
  }

  private async calculateAverageSubscriptionLength(): Promise<number> {
    try {
      const result = await query<{ avg: string }>(`
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as avg 
        FROM subscriptions 
        WHERE state = 'cancelled'
      `);
      
      return parseFloat(result[0].avg || '0');
    } catch (error) {
      return 0;
    }
  }

  private calculateCLV(revenueMetrics: RevenueMetrics, subscriptionMetrics: SubscriptionMetrics): number {
    const avgMonthlyRevenue = revenueMetrics.averageRevenuePerUser;
    const avgSubscriptionLength = subscriptionMetrics.averageSubscriptionLength;
    return avgMonthlyRevenue * avgSubscriptionLength;
  }

  private async getActiveUsers(timeRange: 'day' | 'week' | 'month'): Promise<number> {
    const timeCondition = this.getTimeCondition(timeRange);
    
    try {
      const result = await query<{ count: string }>(`
        SELECT COUNT(DISTINCT s.id) as count 
        FROM subscribers s 
        JOIN subscription_events se ON s.id = se.subscriber_id 
        WHERE se.created_at >= ${timeCondition}
      `);
      
      return parseInt(result[0].count);
    } catch (error) {
      return 0;
    }
  }

  private getAverageResponseTime(): number {
    // This would come from your performance monitoring system
    return Math.random() * 500 + 100; // Placeholder: 100-600ms
  }

  private getErrorRate(): number {
    // This would come from your performance monitoring system
    return Math.random() * 5; // Placeholder: 0-5%
  }

  private getThroughput(): number {
    // This would come from your performance monitoring system
    return Math.random() * 1000 + 100; // Placeholder: 100-1100 requests/minute
  }

  private async calculateUserSatisfactionScore(): Promise<number> {
    // This would typically come from user surveys or feedback
    return Math.random() * 2 + 3; // Placeholder: 3-5 score
  }

  private getAverageSessionDuration(): number {
    // This would come from your analytics system
    return Math.random() * 300 + 60; // Placeholder: 1-6 minutes
  }

  private getBounceRate(): number {
    // This would come from your analytics system
    return Math.random() * 40 + 20; // Placeholder: 20-60%
  }

  private startPeriodicUpdates(): void {
    // Update metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.getKPIDashboard();
        logger.debug('Business metrics updated');
      } catch (error) {
        logger.error('Failed to update business metrics', { error: (error as Error).message });
      }
    }, 5 * 60 * 1000);
  }

  // Analytics methods
  getMetricsHistory(metricName: string, timeRange: 'hour' | 'day' | 'week' = 'day'): BusinessMetric[] {
    const metrics = this.metrics.get(metricName) || [];
    const now = Date.now();
    let cutoffTime: number;

    switch (timeRange) {
      case 'hour':
        cutoffTime = now - 60 * 60 * 1000;
        break;
      case 'day':
        cutoffTime = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
    }

    return metrics.filter(m => m.timestamp >= cutoffTime);
  }

  getMetricSummary(metricName: string): {
    current: number;
    average: number;
    min: number;
    max: number;
    trend: 'up' | 'down' | 'stable';
  } {
    const metrics = this.metrics.get(metricName) || [];
    
    if (metrics.length === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        trend: 'stable'
      };
    }

    const values = metrics.map(m => m.value);
    const current = values[values.length - 1];
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate trend (comparing last 10% with previous 10%)
    const recentCount = Math.max(1, Math.floor(values.length * 0.1));
    const recent = values.slice(-recentCount);
    const previous = values.slice(-recentCount * 2, -recentCount);
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const previousAvg = previous.length > 0 ? 
      previous.reduce((sum, val) => sum + val, 0) / previous.length : recentAvg;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    const threshold = 5; // 5% threshold
    
    if (recentAvg > previousAvg * (1 + threshold / 100)) {
      trend = 'up';
    } else if (recentAvg < previousAvg * (1 - threshold / 100)) {
      trend = 'down';
    }

    return {
      current,
      average,
      min,
      max,
      trend
    };
  }

  clearCache(): void {
    this.kpiCache.clear();
    this.lastUpdated.clear();
  }
}

export const businessMetrics = BusinessMetricsTracker.getInstance();

// Decorator for automatic business metric tracking
export function trackBusinessMetric(name: string, unit: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        
        // Record success metric
        businessMetrics.recordMetric(`${name}_success`, 1, 'count', {
          method: propertyKey,
          duration
        });
        
        businessMetrics.recordMetric(`${name}_duration`, duration, 'ms', {
          method: propertyKey
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Record error metric
        businessMetrics.recordMetric(`${name}_error`, 1, 'count', {
          method: propertyKey,
          duration,
          error: (error as Error).message
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}
