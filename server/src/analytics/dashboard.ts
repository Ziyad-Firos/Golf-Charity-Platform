import { logger } from '../utils/logger';
import { query } from '../db/client';
import { businessMetrics } from '../monitoring/business-metrics';

export interface DashboardMetrics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    monthlyRevenue: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    averageRating: number;
    systemHealth: 'healthy' | 'warning' | 'critical';
  };
  userMetrics: {
    newUsers: number;
    returningUsers: number;
    userGrowthRate: number;
    userRetentionRate: number;
    averageSessionDuration: number;
    topCountries: Array<{ country: string; users: number; percentage: number }>;
    userDemographics: {
      ageGroups: Array<{ group: string; count: number }>;
      genders: Array<{ gender: string; count: number }>;
      locations: Array<{ location: string; count: number }>;
    };
  };
  revenueMetrics: {
    totalRevenue: number;
    monthlyRecurringRevenue: number;
    averageRevenuePerUser: number;
    revenueGrowthRate: number;
    revenueByPlan: Array<{ plan: string; revenue: number; percentage: number }>;
    revenueByMonth: Array<{ month: string; revenue: number }>;
    revenueByCharity: Array<{ charity: string; revenue: number; percentage: number }>;
    churnRate: number;
    customerLifetimeValue: number;
  };
  subscriptionMetrics: {
    totalSubscriptions: number;
    activeSubscriptions: number;
    cancelledSubscriptions: number;
    conversionRate: number;
    churnRate: number;
    averageSubscriptionLength: number;
    subscriptionsByPlan: Array<{ plan: string; count: number; percentage: number }>;
    subscriptionTrends: Array<{ month: string; subscriptions: number; cancellations: number }>;
  };
  performanceMetrics: {
    averageResponseTime: number;
    uptime: number;
    errorRate: number;
    throughput: number;
    databasePerformance: {
      averageQueryTime: number;
      slowQueries: number;
      connectionPoolUsage: number;
    };
    cachePerformance: {
      hitRate: number;
      missRate: number;
      evictionRate: number;
    };
  };
  golfMetrics: {
    totalScores: number;
    averageScore: number;
    bestScore: number;
    mostPlayedCourses: Array<{ course: string; rounds: number }>;
    scoreDistribution: Array<{ score: number; count: number }>;
    monthlyParticipation: Array<{ month: string; participants: number; averageScore: number }>;
  };
}

class AnalyticsDashboard {
  private static instance: AnalyticsDashboard;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): AnalyticsDashboard {
    if (!AnalyticsDashboard.instance) {
      AnalyticsDashboard.instance = new AnalyticsDashboard();
    }
    return AnalyticsDashboard.instance;
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const cacheKey = 'dashboard_metrics';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const [
        overview,
        userMetrics,
        revenueMetrics,
        subscriptionMetrics,
        performanceMetrics,
        golfMetrics
      ] = await Promise.all([
        this.getOverviewMetrics(),
        this.getUserMetrics(),
        this.getRevenueMetrics(),
        this.getSubscriptionMetrics(),
        this.getPerformanceMetrics(),
        this.getGolfMetrics()
      ]);

      const metrics: DashboardMetrics = {
        overview,
        userMetrics,
        revenueMetrics,
        subscriptionMetrics,
        performanceMetrics,
        golfMetrics
      };

      this.setCache(cacheKey, metrics);
      return metrics;
    } catch (error) {
      logger.error('Failed to get dashboard metrics', { error: (error as Error).message });
      throw error;
    }
  }

  private async getOverviewMetrics(): Promise<DashboardMetrics['overview']> {
    const [userMetrics, revenueMetrics, subscriptionMetrics] = await Promise.all([
      businessMetrics.getUserMetrics('month'),
      businessMetrics.getRevenueMetrics('month'),
      businessMetrics.getSubscriptionMetrics('month')
    ]);

    const systemHealth = await this.getSystemHealth();

    return {
      totalUsers: userMetrics.totalUsers,
      activeUsers: userMetrics.activeUsers,
      totalRevenue: revenueMetrics.totalRevenue,
      monthlyRevenue: revenueMetrics.monthlyRecurringRevenue,
      totalSubscriptions: subscriptionMetrics.totalSubscriptions,
      activeSubscriptions: subscriptionMetrics.activeSubscriptions,
      averageRating: 4.5, // Placeholder - would come from user ratings
      systemHealth
    };
  }

  private async getUserMetrics(): Promise<DashboardMetrics['userMetrics']> {
    const [userMetrics, demographics] = await Promise.all([
      businessMetrics.getUserMetrics('month'),
      this.getUserDemographics()
    ]);

    return {
      newUsers: userMetrics.newUsers,
      returningUsers: userMetrics.returningUsers,
      userGrowthRate: this.calculateGrowthRate('users'),
      userRetentionRate: userMetrics.userRetentionRate,
      averageSessionDuration: 1800, // 30 minutes placeholder
      topCountries: await this.getTopCountries(),
      userDemographics: demographics
    };
  }

  private async getRevenueMetrics(): Promise<DashboardMetrics['revenueMetrics']> {
    const revenueMetrics = await businessMetrics.getRevenueMetrics('month');

    return {
      totalRevenue: revenueMetrics.totalRevenue,
      monthlyRecurringRevenue: revenueMetrics.monthlyRecurringRevenue,
      averageRevenuePerUser: revenueMetrics.averageRevenuePerUser,
      revenueGrowthRate: revenueMetrics.revenueGrowthRate,
      revenueByPlan: this.formatRevenueByPlan(revenueMetrics.revenueByPlan),
      revenueByMonth: await this.getRevenueByMonth(),
      revenueByCharity: this.formatRevenueByCharity(revenueMetrics.revenueByCharity),
      churnRate: 0.05, // 5% placeholder
      customerLifetimeValue: this.calculateCLV(revenueMetrics)
    };
  }

  private async getSubscriptionMetrics(): Promise<DashboardMetrics['subscriptionMetrics']> {
    const subscriptionMetrics = await businessMetrics.getSubscriptionMetrics('month');

    return {
      totalSubscriptions: subscriptionMetrics.totalSubscriptions,
      activeSubscriptions: subscriptionMetrics.activeSubscriptions,
      cancelledSubscriptions: subscriptionMetrics.cancelledSubscriptions,
      conversionRate: subscriptionMetrics.conversionRate,
      churnRate: subscriptionMetrics.churnRate,
      averageSubscriptionLength: subscriptionMetrics.averageSubscriptionLength,
      subscriptionsByPlan: this.formatSubscriptionsByPlan(subscriptionMetrics.subscriptionByPlan),
      subscriptionTrends: await this.getSubscriptionTrends()
    };
  }

  private async getPerformanceMetrics(): Promise<DashboardMetrics['performanceMetrics']> {
    const performanceMetrics = await businessMetrics.getPerformanceMetrics();

    return {
      averageResponseTime: performanceMetrics.averageResponseTime,
      uptime: performanceMetrics.uptime,
      errorRate: performanceMetrics.errorRate,
      throughput: performanceMetrics.throughput,
      databasePerformance: await this.getDatabasePerformance(),
      cachePerformance: await this.getCachePerformance()
    };
  }

  private async getGolfMetrics(): Promise<DashboardMetrics['golfMetrics']> {
    try {
      const [totalScores, averageScore, bestScore] = await Promise.all([
        query<{ count: string }>('SELECT COUNT(*) as count FROM scores'),
        query<{ avg: string }>('SELECT AVG(stableford_score) as avg FROM scores'),
        query<{ max: string }>('SELECT MAX(stableford_score) as max FROM scores')
      ]);

      return {
        totalScores: parseInt(totalScores[0].count),
        averageScore: parseFloat(averageScore[0].avg || '0'),
        bestScore: parseInt(bestScore[0].max || '0'),
        mostPlayedCourses: await this.getMostPlayedCourses(),
        scoreDistribution: await this.getScoreDistribution(),
        monthlyParticipation: await this.getMonthlyParticipation()
      };
    } catch (error) {
      logger.error('Failed to get golf metrics', { error: (error as Error).message });
      return {
        totalScores: 0,
        averageScore: 0,
        bestScore: 0,
        mostPlayedCourses: [],
        scoreDistribution: [],
        monthlyParticipation: []
      };
    }
  }

  private async getSystemHealth(): Promise<'healthy' | 'warning' | 'critical'> {
    try {
      // Check database connectivity
      await query('SELECT 1');
      
      // Check error rate
      const performanceMetrics = await businessMetrics.getPerformanceMetrics();
      
      if (performanceMetrics.errorRate > 10) {
        return 'critical';
      } else if (performanceMetrics.errorRate > 5) {
        return 'warning';
      }
      
      return 'healthy';
    } catch (error) {
      return 'critical';
    }
  }

  private async getUserDemographics(): Promise<DashboardMetrics['userMetrics']['userDemographics']> {
    // Placeholder implementation
    return {
      ageGroups: [
        { group: '18-24', count: 100 },
        { group: '25-34', count: 200 },
        { group: '35-44', count: 150 },
        { group: '45-54', count: 100 },
        { group: '55+', count: 50 }
      ],
      genders: [
        { gender: 'male', count: 350 },
        { gender: 'female', count: 200 },
        { gender: 'other', count: 50 }
      ],
      locations: [
        { location: 'United States', count: 300 },
        { location: 'United Kingdom', count: 150 },
        { location: 'Canada', count: 100 },
        { location: 'Australia', count: 50 }
      ]
    };
  }

  private async getTopCountries(): Promise<Array<{ country: string; users: number; percentage: number }>> {
    // Placeholder implementation
    return [
      { country: 'United States', users: 300, percentage: 40 },
      { country: 'United Kingdom', users: 150, percentage: 20 },
      { country: 'Canada', users: 100, percentage: 13 },
      { country: 'Australia', users: 50, percentage: 7 }
    ];
  }

  private calculateGrowthRate(metric: string): number {
    // Placeholder implementation
    return 15.5; // 15.5% growth
  }

  private formatRevenueByPlan(revenueByPlan: Record<string, number>): Array<{ plan: string; revenue: number; percentage: number }> {
    const total = Object.values(revenueByPlan).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(revenueByPlan).map(([plan, revenue]) => ({
      plan,
      revenue,
      percentage: total > 0 ? (revenue / total) * 100 : 0
    }));
  }

  private formatRevenueByCharity(revenueByCharity: Record<string, number>): Array<{ charity: string; revenue: number; percentage: number }> {
    const total = Object.values(revenueByCharity).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(revenueByCharity).map(([charity, revenue]) => ({
      charity,
      revenue,
      percentage: total > 0 ? (revenue / total) * 100 : 0
    }));
  }

  private formatSubscriptionsByPlan(subscriptionsByPlan: Record<string, number>): Array<{ plan: string; count: number; percentage: number }> {
    const total = Object.values(subscriptionsByPlan).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(subscriptionsByPlan).map(([plan, count]) => ({
      plan,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }));
  }

  private async getRevenueByMonth(): Promise<Array<{ month: string; revenue: number }>> {
    try {
      const results = await query<{ month: string; revenue: string }>(`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COALESCE(SUM(amount), 0) as revenue
        FROM payments 
        WHERE status = 'completed' 
        AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month
        ORDER BY month DESC
      `);

      return results.map(row => ({
        month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: parseFloat(row.revenue)
      }));
    } catch (error) {
      logger.error('Failed to get revenue by month', { error: (error as Error).message });
      return [];
    }
  }

  private async getSubscriptionTrends(): Promise<Array<{ month: string; subscriptions: number; cancellations: number }>> {
    // Placeholder implementation
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        subscriptions: Math.floor(Math.random() * 50) + 20,
        cancellations: Math.floor(Math.random() * 10) + 5
      });
    }
    
    return months;
  }

  private calculateCLV(revenueMetrics: any): number {
    return revenueMetrics.averageRevenuePerUser * 12; // Simplified CLV calculation
  }

  private async getDatabasePerformance(): Promise<DashboardMetrics['performanceMetrics']['databasePerformance']> {
    try {
      const [avgQueryTime, slowQueries, connectionUsage] = await Promise.all([
        query<{ avg: string }>('SELECT AVG(EXTRACT(EPOCH FROM (query_end - query_start)) * 1000) as avg FROM pg_stat_statements'),
        query<{ count: string }>('SELECT COUNT(*) as count FROM pg_stat_statements WHERE mean_exec_time > 1000'),
        query<{ usage: string }>('SELECT COUNT(*) as usage FROM pg_stat_activity WHERE state = \'active\'')
      ]);

      return {
        averageQueryTime: parseFloat(avgQueryTime[0].avg || '0'),
        slowQueries: parseInt(slowQueries[0].count),
        connectionPoolUsage: (parseInt(connectionUsage[0].usage) / 100) * 100
      };
    } catch (error) {
      logger.error('Failed to get database performance', { error: (error as Error).message });
      return {
        averageQueryTime: 0,
        slowQueries: 0,
        connectionPoolUsage: 0
      };
    }
  }

  private async getCachePerformance(): Promise<DashboardMetrics['performanceMetrics']['cachePerformance']> {
    try {
      const { cache } = require('../utils/cache');
      const stats = cache.getStats();

      return {
        hitRate: stats.hitRate,
        missRate: stats.missRate,
        evictionRate: 0 // Placeholder
      };
    } catch (error) {
      logger.error('Failed to get cache performance', { error: (error as Error).message });
      return {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0
      };
    }
  }

  private async getMostPlayedCourses(): Promise<Array<{ course: string; rounds: number }>> {
    try {
      const results = await query<{ course_name: string; count: string }>(`
        SELECT course_name, COUNT(*) as count 
        FROM scores 
        WHERE course_name IS NOT NULL
        GROUP BY course_name 
        ORDER BY count DESC 
        LIMIT 10
      `);

      return results.map(row => ({
        course: row.course_name,
        rounds: parseInt(row.count)
      }));
    } catch (error) {
      logger.error('Failed to get most played courses', { error: (error as Error).message });
      return [];
    }
  }

  private async getScoreDistribution(): Promise<Array<{ score: number; count: number }>> {
    try {
      const results = await query<{ stableford_score: number; count: string }>(`
        SELECT stableford_score, COUNT(*) as count 
        FROM scores 
        GROUP BY stableford_score 
        ORDER BY stableford_score
      `);

      return results.map(row => ({
        score: row.stableford_score,
        count: parseInt(row.count)
      }));
    } catch (error) {
      logger.error('Failed to get score distribution', { error: (error as Error).message });
      return [];
    }
  }

  private async getMonthlyParticipation(): Promise<Array<{ month: string; participants: number; averageScore: number }>> {
    try {
      const results = await query<{ month: string; participants: string; avg_score: string }>(`
        SELECT 
          DATE_TRUNC('month', played_on) as month,
          COUNT(DISTINCT subscriber_id) as participants,
          AVG(stableford_score) as avg_score
        FROM scores 
        WHERE played_on >= NOW() - INTERVAL '12 months'
        GROUP BY month
        ORDER BY month DESC
      `);

      return results.map(row => ({
        month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        participants: parseInt(row.participants),
        averageScore: parseFloat(row.avg_score || '0')
      }));
    } catch (error) {
      logger.error('Failed to get monthly participation', { error: (error as Error).message });
      return [];
    }
  }

  // Cache management
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Export methods
  async exportMetrics(format: 'json' | 'csv' = 'json'): Promise<string> {
    const metrics = await this.getDashboardMetrics();
    
    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(metrics);
    }
    
    throw new Error(`Unsupported format: ${format}`);
  }

  private convertToCSV(metrics: DashboardMetrics): string {
    // Simplified CSV conversion
    const rows = [
      'Metric,Value',
      `Total Users,${metrics.overview.totalUsers}`,
      `Active Users,${metrics.overview.activeUsers}`,
      `Total Revenue,${metrics.overview.totalRevenue}`,
      `Monthly Revenue,${metrics.overview.monthlyRevenue}`,
      `Total Subscriptions,${metrics.overview.totalSubscriptions}`,
      `Active Subscriptions,${metrics.overview.activeSubscriptions}`,
      `Average Response Time,${metrics.performanceMetrics.averageResponseTime}`,
      `Uptime,${metrics.performanceMetrics.uptime}`,
      `Error Rate,${metrics.performanceMetrics.errorRate}`,
      `Total Scores,${metrics.golfMetrics.totalScores}`,
      `Average Score,${metrics.golfMetrics.averageScore}`,
      `Best Score,${metrics.golfMetrics.bestScore}`
    ];

    return rows.join('\n');
  }

  // Real-time updates
  async getRealtimeMetrics(): Promise<Partial<DashboardMetrics>> {
    try {
      const [performanceMetrics, systemHealth] = await Promise.all([
        businessMetrics.getPerformanceMetrics(),
        this.getSystemHealth()
      ]);

      return {
        performanceMetrics,
        overview: {
          systemHealth,
          totalUsers: 0,
          activeUsers: 0,
          totalRevenue: 0,
          monthlyRevenue: 0,
          totalSubscriptions: 0,
          activeSubscriptions: 0,
          averageRating: 0
        }
      };
    } catch (error) {
      logger.error('Failed to get realtime metrics', { error: (error as Error).message });
      return {};
    }
  }
}

export const analyticsDashboard = AnalyticsDashboard.getInstance();
