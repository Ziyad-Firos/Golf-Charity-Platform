import { config } from './index';

export interface ScalabilityConfig {
  clustering: {
    enabled: boolean;
    workers: number;
    maxMemory: number;
    gracefulShutdownTimeout: number;
  };
  loadBalancing: {
    enabled: boolean;
    strategy: 'round-robin' | 'least-connections' | 'ip-hash';
    healthCheckInterval: number;
    maxRetries: number;
    retryDelay: number;
  };
  rateLimiting: {
    enabled: boolean;
    globalLimit: number;
    perIPLimit: number;
    windowMs: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  caching: {
    enabled: boolean;
    strategy: 'memory' | 'redis' | 'cluster';
    ttl: number;
    maxSize: number;
    compressionEnabled: boolean;
  };
  database: {
    connectionPool: {
      min: number;
      max: number;
      idleTimeoutMillis: number;
      acquireTimeoutMillis: number;
    };
    readReplicas: string[];
    sharding: {
      enabled: boolean;
      strategy: 'hash' | 'range' | 'directory';
      shardCount: number;
    };
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
    alertingEnabled: boolean;
  };
  session: {
    store: 'memory' | 'redis' | 'cluster';
    ttl: number;
    rolling: boolean;
    touchAfter: number;
  };
}

export const scalabilityConfig: ScalabilityConfig = {
  clustering: {
    enabled: config.get('nodeEnv') === 'production',
    workers: parseInt(process.env.CLUSTER_WORKERS || '0') || require('os').cpus().length,
    maxMemory: parseInt(process.env.CLUSTER_MAX_MEMORY || '1024'),
    gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000')
  },
  loadBalancing: {
    enabled: process.env.LOAD_BALANCING_ENABLED === 'true',
    strategy: (process.env.LOAD_BALANCING_STRATEGY || 'round-robin') as any,
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '1000')
  },
  rateLimiting: {
    enabled: process.env.RATE_LIMITING_ENABLED === 'true',
    globalLimit: parseInt(process.env.GLOBAL_RATE_LIMIT || '1000'),
    perIPLimit: parseInt(process.env.PER_IP_RATE_LIMIT || '100'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
  },
  caching: {
    enabled: process.env.CACHING_ENABLED === 'true',
    strategy: (process.env.CACHE_STRATEGY || 'memory') as any,
    ttl: parseInt(process.env.CACHE_TTL || '300000'),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
    compressionEnabled: process.env.CACHE_COMPRESSION_ENABLED === 'true'
  },
  database: {
    connectionPool: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000')
    },
    readReplicas: (process.env.DB_READ_REPLICAS || '').split(',').filter(Boolean),
    sharding: {
      enabled: process.env.DB_SHARDING_ENABLED === 'true',
      strategy: (process.env.DB_SHARDING_STRATEGY || 'hash') as any,
      shardCount: parseInt(process.env.DB_SHARD_COUNT || '4')
    }
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
    alertingEnabled: process.env.ALERTING_ENABLED === 'true'
  },
  session: {
    store: (process.env.SESSION_STORE || 'memory') as any,
    ttl: parseInt(process.env.SESSION_TTL || '86400000'),
    rolling: process.env.SESSION_ROLLING === 'true',
    touchAfter: parseInt(process.env.SESSION_TOUCH_AFTER || '0')
  }
};

// Cluster management
export class ClusterManager {
  private static instance: ClusterManager;
  private workers: any[] = [];
  private isShuttingDown = false;

  private constructor() {
    if (scalabilityConfig.clustering.enabled) {
      this.setupCluster();
    }
  }

  static getInstance(): ClusterManager {
    if (!ClusterManager.instance) {
      ClusterManager.instance = new ClusterManager();
    }
    return ClusterManager.instance;
  }

  private setupCluster(): void {
    const cluster = require('cluster');
    const numCPUs = scalabilityConfig.clustering.workers;

    if (cluster.isMaster) {
      console.log(`Master ${process.pid} is running`);

      // Fork workers
      for (let i = 0; i < numCPUs; i++) {
        this.forkWorker();
      }

      // Handle worker exits
      cluster.on('exit', (worker: any, code: number, signal: string) => {
        console.log(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
        console.log('Starting a new worker');
        this.forkWorker();
      });

      // Handle graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());
    } else {
      console.log(`Worker ${process.pid} started`);
      // Worker process will continue with normal application startup
    }
  }

  private forkWorker(): void {
    const cluster = require('cluster');
    const worker = cluster.fork();
    this.workers.push(worker);

    worker.on('exit', () => {
      this.workers = this.workers.filter(w => w !== worker);
    });
  }

  private gracefulShutdown(): void {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('Starting graceful shutdown...');

    const timeout = setTimeout(() => {
      console.log('Forced shutdown after timeout');
      process.exit(1);
    }, scalabilityConfig.clustering.gracefulShutdownTimeout);

    // Shutdown workers
    this.workers.forEach(worker => {
      worker.send('shutdown');
      worker.disconnect();
    });

    // Check if all workers have disconnected
    const checkInterval = setInterval(() => {
      if (this.workers.length === 0) {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        console.log('Graceful shutdown completed');
        process.exit(0);
      }
    }, 1000);
  }

  isClusterEnabled(): boolean {
    return scalabilityConfig.clustering.enabled;
  }

  getWorkerCount(): number {
    return this.workers.length;
  }
}

// Load balancer
export class LoadBalancer {
  private static instance: LoadBalancer;
  private servers: any[] = [];
  private currentIndex = 0;
  private connections = new Map<string, number>();

  private constructor() {
    this.setupServers();
  }

  static getInstance(): LoadBalancer {
    if (!LoadBalancer.instance) {
      LoadBalancer.instance = new LoadBalancer();
    }
    return LoadBalancer.instance;
  }

  private setupServers(): void {
    if (!scalabilityConfig.loadBalancing.enabled) return;

    // Initialize server pool (this would be configured based on your infrastructure)
    // For now, we'll use a placeholder implementation
    this.servers = [
      { id: 'server1', host: 'localhost', port: 3001, weight: 1 },
      { id: 'server2', host: 'localhost', port: 3002, weight: 1 },
      { id: 'server3', host: 'localhost', port: 3003, weight: 1 }
    ];
  }

  selectServer(clientId?: string): any {
    if (!scalabilityConfig.loadBalancing.enabled || this.servers.length === 0) {
      return null;
    }

    switch (scalabilityConfig.loadBalancing.strategy) {
      case 'round-robin':
        return this.roundRobinSelect();
      case 'least-connections':
        return this.leastConnectionsSelect();
      case 'ip-hash':
        return this.ipHashSelect(clientId);
      default:
        return this.roundRobinSelect();
    }
  }

  private roundRobinSelect(): any {
    const server = this.servers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.servers.length;
    return server;
  }

  private leastConnectionsSelect(): any {
    return this.servers.reduce((min, server) => {
      const connections = this.connections.get(server.id) || 0;
      const minConnections = this.connections.get(min.id) || 0;
      return connections < minConnections ? server : min;
    });
  }

  private ipHashSelect(clientId?: string): any {
    if (!clientId) return this.roundRobinSelect();
    
    const hash = this.hashCode(clientId);
    const index = Math.abs(hash) % this.servers.length;
    return this.servers[index];
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  incrementConnections(serverId: string): void {
    const current = this.connections.get(serverId) || 0;
    this.connections.set(serverId, current + 1);
  }

  decrementConnections(serverId: string): void {
    const current = this.connections.get(serverId) || 0;
    this.connections.set(serverId, Math.max(0, current - 1));
  }

  getServerStats(): any {
    return this.servers.map(server => ({
      id: server.id,
      host: server.host,
      port: server.port,
      connections: this.connections.get(server.id) || 0
    }));
  }
}

// Auto-scaling
export class AutoScaler {
  private static instance: AutoScaler;
  private metrics = new Map<string, number[]>();
  private scalingRules = new Map<string, any>();

  private constructor() {
    this.setupDefaultRules();
    this.startMonitoring();
  }

  static getInstance(): AutoScaler {
    if (!AutoScaler.instance) {
      AutoScaler.instance = new AutoScaler();
    }
    return AutoScaler.instance;
  }

  private setupDefaultRules(): void {
    // CPU-based scaling
    this.scalingRules.set('cpu', {
      scaleUpThreshold: 80,
      scaleDownThreshold: 30,
      minInstances: 2,
      maxInstances: 10,
      cooldownMs: 300000 // 5 minutes
    });

    // Memory-based scaling
    this.scalingRules.set('memory', {
      scaleUpThreshold: 85,
      scaleDownThreshold: 40,
      minInstances: 2,
      maxInstances: 10,
      cooldownMs: 300000
    });

    // Response time-based scaling
    this.scalingRules.set('response_time', {
      scaleUpThreshold: 2000, // 2 seconds
      scaleDownThreshold: 500, // 0.5 seconds
      minInstances: 2,
      maxInstances: 10,
      cooldownMs: 300000
    });
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.collectMetrics();
      this.checkScalingRules();
    }, 60000); // Check every minute
  }

  private collectMetrics(): void {
    // CPU usage
    const cpuUsage = this.getCpuUsage();
    this.addMetric('cpu', cpuUsage);

    // Memory usage
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.addMetric('memory', memPercent);

    // Response time (would come from performance monitor)
    const responseTime = this.getAverageResponseTime();
    this.addMetric('response_time', responseTime);
  }

  private addMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only last 10 values
    if (values.length > 10) {
      values.shift();
    }
  }

  private getAverageMetric(name: string): number {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private checkScalingRules(): void {
    for (const [metric, rule] of this.scalingRules.entries()) {
      const average = this.getAverageMetric(metric);
      
      if (average > rule.scaleUpThreshold) {
        this.scaleUp(metric, average);
      } else if (average < rule.scaleDownThreshold) {
        this.scaleDown(metric, average);
      }
    }
  }

  private scaleUp(metric: string, value: number): void {
    console.log(`Scale up triggered by ${metric}: ${value}`);
    // Implementation would depend on your infrastructure (Kubernetes, AWS, etc.)
    // This is a placeholder for the scaling logic
  }

  private scaleDown(metric: string, value: number): void {
    console.log(`Scale down triggered by ${metric}: ${value}`);
    // Implementation would depend on your infrastructure
    // This is a placeholder for the scaling logic
  }

  private getCpuUsage(): number {
    // Simplified CPU usage calculation
    // In production, use a proper CPU monitoring library
    return Math.random() * 100;
  }

  private getAverageResponseTime(): number {
    // This would come from your performance monitoring system
    return Math.random() * 1000;
  }

  getScalingMetrics(): any {
    const result: any = {};
    
    for (const [metric, values] of this.metrics.entries()) {
      result[metric] = {
        current: values[values.length - 1] || 0,
        average: this.getAverageMetric(metric),
        trend: this.getTrend(values),
        rule: this.scalingRules.get(metric)
      };
    }
    
    return result;
  }

  private getTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-3);
    const older = values.slice(-6, -3);
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    const threshold = 5; // 5% threshold
    
    if (diff > threshold) return 'up';
    if (diff < -threshold) return 'down';
    return 'stable';
  }
}

// Circuit breaker pattern
export class CircuitBreaker {
  private static instances = new Map<string, CircuitBreaker>();
  
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private name: string,
    private options: {
      failureThreshold: number;
      recoveryTimeout: number;
      monitoringPeriod: number;
    }
  ) {}

  static getInstance(name: string, options?: any): CircuitBreaker {
    if (!CircuitBreaker.instances.has(name)) {
      CircuitBreaker.instances.set(name, new CircuitBreaker(name, options || {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 10000
      }));
    }
    return CircuitBreaker.instances.get(name)!;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker ${this.name} is open`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

// Export instances
export const clusterManager = ClusterManager.getInstance();
export const loadBalancer = LoadBalancer.getInstance();
export const autoScaler = AutoScaler.getInstance();
