import { query, checkDatabaseHealth, getPoolStats } from './client';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

export interface DatabaseMetrics {
  connectionCount: number;
  idleConnections: number;
  waitingConnections: number;
  averageQueryTime: number;
  slowQueries: number;
  errorRate: number;
  totalQueries: number;
  cacheHitRatio?: number;
  databaseSize?: number;
  indexUsage?: Array<{
    tableName: string;
    indexName: string;
    scans: number;
    tuplesRead: number;
    tuplesReturned: number;
  }>;
}

export class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private metrics: DatabaseMetrics = {
    connectionCount: 0,
    idleConnections: 0,
    waitingConnections: 0,
    averageQueryTime: 0,
    slowQueries: 0,
    errorRate: 0,
    totalQueries: 0
  };

  private constructor() {}

  static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }

  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Database monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting database monitoring', { intervalMs });

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error('Failed to collect database metrics', { error: (error as Error).message });
      }
    }, intervalMs);

    // Initial metrics collection
    await this.collectMetrics();
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      logger.warn('Database monitoring is not running');
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Database monitoring stopped');
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Basic health check
      const health = await checkDatabaseHealth();
      
      // Pool statistics
      const poolStats = getPoolStats();
      
      // Query performance metrics
      const queryMetrics = await this.getQueryMetrics();
      
      // Database size and table statistics
      const dbStats = await this.getDatabaseStats();
      
      // Index usage statistics
      const indexStats = await this.getIndexUsageStats();

      this.metrics = {
        connectionCount: health.totalConnections,
        idleConnections: health.idleConnections,
        waitingConnections: health.waitingConnections,
        averageQueryTime: queryMetrics.averageQueryTime,
        slowQueries: queryMetrics.slowQueries,
        errorRate: queryMetrics.errorRate,
        totalQueries: queryMetrics.totalQueries,
        cacheHitRatio: dbStats.cacheHitRatio,
        databaseSize: dbStats.databaseSize,
        indexUsage: indexStats
      };

      // Log metrics
      logger.debug('Database metrics collected', this.metrics);

      // Record metrics in monitoring system
      metrics.recordRequest('DB_HEALTH', health.averageQueryTime || 0, health.connected);
      metrics.recordRequest('DB_QUERIES', this.metrics.averageQueryTime, this.metrics.errorRate < 5);

      // Check for alerts
      await this.checkAlerts();

    } catch (error) {
      logger.error('Failed to collect database metrics', { error: (error as Error).message });
    }
  }

  private async getQueryMetrics(): Promise<{
    averageQueryTime: number;
    slowQueries: number;
    errorRate: number;
    totalQueries: number;
  }> {
    try {
      // Get query statistics from pg_stat_statements
      const result = await query(`
        SELECT 
          COUNT(*) as total_queries,
          AVG(mean_exec_time) as avg_time,
          SUM(CASE WHEN mean_exec_time > 1000 THEN 1 ELSE 0 END) as slow_queries,
          SUM(CASE WHEN calls > 0 THEN 1 ELSE 0 END) as error_queries
        FROM pg_stat_statements
      `);

      const stats = result[0];
      const totalQueries = parseInt(stats.total_queries) || 0;
      const avgTime = parseFloat(stats.avg_time) || 0;
      const slowQueries = parseInt(stats.slow_queries) || 0;
      const errorQueries = parseInt(stats.error_queries) || 0;
      const errorRate = totalQueries > 0 ? (errorQueries / totalQueries) * 100 : 0;

      return {
        averageQueryTime: avgTime,
        slowQueries,
        errorRate,
        totalQueries
      };
    } catch (error) {
      // pg_stat_statements might not be enabled
      logger.warn('pg_stat_statements not available, using fallback metrics');
      
      // Get metrics from our own monitoring
      const apiMetrics = metrics.getMetrics();
      const dbMetrics = (apiMetrics as any).endpoints?.['DB_SELECT'] || (apiMetrics as any).endpoints?.['DB_INSERT'] || { count: 0, averageResponseTime: 0 };
      
      return {
        averageQueryTime: dbMetrics.averageResponseTime || 0,
        slowQueries: 0,
        errorRate: apiMetrics.errorRate || 0,
        totalQueries: dbMetrics.count || 0
      };
    }
  }

  private async getDatabaseStats(): Promise<{
    databaseSize: number;
    cacheHitRatio: number;
  }> {
    try {
      const result = await query(`
        SELECT 
          pg_database_size(current_database()) as database_size,
          (SELECT SUM(blks_hit) / (SUM(blks_hit) + SUM(blks_read)) * 100 
           FROM pg_stat_database WHERE datname = current_database()) as cache_hit_ratio
      `);

      const stats = result[0];
      
      return {
        databaseSize: parseInt(stats.database_size) || 0,
        cacheHitRatio: parseFloat(stats.cache_hit_ratio) || 0
      };
    } catch (error) {
      logger.warn('Failed to get database stats', { error: (error as Error).message });
      return { databaseSize: 0, cacheHitRatio: 0 };
    }
  }

  private async getIndexUsageStats(): Promise<Array<{
    tableName: string;
    indexName: string;
    scans: number;
    tuplesRead: number;
    tuplesReturned: number;
  }>> {
    try {
      const result = await query(`
        SELECT 
          schemaname || '.' || tablename as table_name,
          indexrelname as index_name,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_returned
        FROM pg_stat_user_indexes
        WHERE idx_scan > 0
        ORDER BY idx_scan DESC
        LIMIT 20
      `);

      return result.map(row => ({
        tableName: row.table_name,
        indexName: row.index_name,
        scans: parseInt(row.scans),
        tuplesRead: parseInt(row.tuples_read),
        tuplesReturned: parseInt(row.tuples_returned)
      }));
    } catch (error) {
      logger.warn('Failed to get index usage stats', { error: (error as Error).message });
      return [];
    }
  }

  private async checkAlerts(): Promise<void> {
    const alerts = [];

    // Check connection pool usage
    if (this.metrics.connectionCount > 15) {
      alerts.push({
        type: 'HIGH_CONNECTION_USAGE',
        message: `High connection pool usage: ${this.metrics.connectionCount}/20`,
        severity: 'WARNING'
      });
    }

    // Check waiting connections
    if (this.metrics.waitingConnections > 0) {
      alerts.push({
        type: 'WAITING_CONNECTIONS',
        message: `Clients waiting for connections: ${this.metrics.waitingConnections}`,
        severity: 'WARNING'
      });
    }

    // Check slow queries
    if (this.metrics.slowQueries > 10) {
      alerts.push({
        type: 'SLOW_QUERIES',
        message: `High number of slow queries: ${this.metrics.slowQueries}`,
        severity: 'WARNING'
      });
    }

    // Check error rate
    if (this.metrics.errorRate > 5) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        message: `High database error rate: ${this.metrics.errorRate.toFixed(2)}%`,
        severity: 'CRITICAL'
      });
    }

    // Check cache hit ratio
    if (this.metrics.cacheHitRatio && this.metrics.cacheHitRatio < 90) {
      alerts.push({
        type: 'LOW_CACHE_HIT_RATIO',
        message: `Low cache hit ratio: ${this.metrics.cacheHitRatio.toFixed(2)}%`,
        severity: 'WARNING'
      });
    }

    // Log alerts
    for (const alert of alerts) {
      logger.warn('Database alert', alert);
    }

    // In production, you might send these to a monitoring service
    if (alerts.length > 0 && process.env.NODE_ENV === 'production') {
      // Example: send to PagerDuty, Slack, etc.
    }
  }

  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  async getDetailedReport(): Promise<{
    health: any;
    metrics: DatabaseMetrics;
    slowQueries: Array<{
      query: string;
      calls: number;
      totalTime: number;
      meanTime: number;
    }>;
    tableStats: Array<{
      tableName: string;
      rowCount: number;
      size: number;
      indexes: number;
    }>;
  }> {
    const health = await checkDatabaseHealth();
    const metrics = this.getMetrics();
    
    // Get slow queries
    let slowQueries = [];
    try {
      const result = await query(`
        SELECT query, calls, total_exec_time, mean_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > 1000
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);
      slowQueries = result;
    } catch (error) {
      logger.warn('Failed to get slow queries', { error: (error as Error).message });
    }

    // Get table statistics
    let tableStats = [];
    try {
      const result = await query(`
        SELECT 
          schemaname || '.' || tablename as table_name,
          n_tup_ins + n_tup_upd + n_tup_del as row_count,
          pg_total_relation_size(schemaname || '.' || tablename) as size,
          (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.tablename AND schemaname = t.schemaname) as indexes
        FROM pg_stat_user_tables t
        ORDER BY size DESC
        LIMIT 20
      `);
      tableStats = result;
    } catch (error) {
      logger.warn('Failed to get table stats', { error: (error as Error).message });
    }

    return {
      health,
      metrics,
      slowQueries,
      tableStats
    };
  }

  async runHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message: string;
      duration: number;
    }>;
    overallScore: number;
  }> {
    const checks = [];
    let totalScore = 0;
    let maxScore = 0;

    // Database connectivity check
    const start = Date.now();
    try {
      await query('SELECT 1');
      checks.push({
        name: 'Database Connectivity',
        status: 'pass',
        message: 'Database is reachable',
        duration: Date.now() - start
      });
      totalScore += 25;
    } catch (error) {
      checks.push({
        name: 'Database Connectivity',
        status: 'fail',
        message: 'Database is not reachable',
        duration: Date.now() - start
      });
    }
    maxScore += 25;

    // Connection pool check
    const poolStats = getPoolStats();
    const connectionScore = Math.max(0, 25 - (poolStats.totalCount || 0) + 5);
    checks.push({
      name: 'Connection Pool',
      status: poolStats.totalCount < 15 ? 'pass' : 'warn',
      message: `${poolStats.totalCount || 0} connections in use`,
      duration: 0
    });
    totalScore += connectionScore;
    maxScore += 25;

    // Query performance check
    const queryStart = Date.now();
    try {
      await query('SELECT COUNT(*) FROM subscribers');
      const queryTime = Date.now() - queryStart;
      const performanceScore = Math.max(0, 25 - queryTime / 10);
      checks.push({
        name: 'Query Performance',
        status: queryTime < 100 ? 'pass' : queryTime < 500 ? 'warn' : 'fail',
        message: `Sample query took ${queryTime}ms`,
        duration: queryTime
      });
      totalScore += performanceScore;
    } catch (error) {
      checks.push({
        name: 'Query Performance',
        status: 'fail',
        message: 'Query failed',
        duration: Date.now() - queryStart
      });
    }
    maxScore += 25;

    // Error rate check
    const errorScore = Math.max(0, 25 - this.metrics.errorRate * 5);
    checks.push({
      name: 'Error Rate',
      status: this.metrics.errorRate < 1 ? 'pass' : this.metrics.errorRate < 5 ? 'warn' : 'fail',
      message: `Error rate: ${this.metrics.errorRate.toFixed(2)}%`,
      duration: 0
    });
    totalScore += errorScore;
    maxScore += 25;

    const overallScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const status = overallScore >= 80 ? 'healthy' : overallScore >= 60 ? 'degraded' : 'unhealthy';

    return {
      status,
      checks,
      overallScore
    };
  }
}

export const databaseMonitor = DatabaseMonitor.getInstance();
