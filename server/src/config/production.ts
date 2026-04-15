import { config } from './index';
import { logger } from '../utils/logger';

export interface ProductionConfig {
  server: {
    port: number;
    host: string;
    trustProxy: boolean;
    keepAliveTimeout: number;
    headersTimeout: number;
  };
  security: {
    helmet: {
      contentSecurityPolicy: boolean;
      crossOriginEmbedderPolicy: boolean;
      crossOriginOpenerPolicy: boolean;
      crossOriginResourcePolicy: boolean;
      dnsPrefetchControl: boolean;
      frameguard: boolean;
      hidePoweredBy: boolean;
      hsts: boolean;
      ieNoOpen: boolean;
      noSniff: boolean;
      originAgentCluster: boolean;
      permittedCrossDomainPolicies: boolean;
      referrerPolicy: boolean;
      xssFilter: boolean;
    };
    cors: {
      origin: string | string[];
      credentials: boolean;
      methods: string[];
      allowedHeaders: string[];
      exposedHeaders: string[];
      maxAge: number;
    };
    rateLimit: {
      windowMs: number;
      max: number;
      message: string;
      standardHeaders: boolean;
      legacyHeaders: boolean;
    };
  };
  performance: {
    compression: boolean;
    etag: boolean;
    maxAge: number;
    setHeaders: boolean;
    defer: boolean;
  };
  monitoring: {
    enabled: boolean;
    level: string;
    format: string;
    colorize: boolean;
    timestamp: boolean;
    json: boolean;
  };
  database: {
    ssl: boolean;
    maxConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
    acquireTimeout: number;
    reapIntervalMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
  };
  cache: {
    type: 'memory' | 'redis' | 'cluster';
    ttl: number;
    max: number;
    updateAgeOnGet: boolean;
    checkPeriod: number;
    redis?: {
      host: string;
      port: number;
      password?: string;
      db: number;
      keyPrefix: string;
    };
  };
  session: {
    secret: string;
    resave: boolean;
    saveUninitialized: boolean;
    rolling: boolean;
    cookie: {
      secure: boolean;
      httpOnly: boolean;
      sameSite: 'strict' | 'lax' | 'none';
      maxAge: number;
      path: string;
      domain?: string;
    };
    store: 'memory' | 'redis' | 'cluster';
  };
  clustering: {
    enabled: boolean;
    workers: number;
    maxMemory: number;
    gracefulShutdown: number;
  };
}

export class ProductionConfigManager {
  private static instance: ProductionConfigManager;
  private config: ProductionConfig;

  private constructor() {
    this.config = this.createProductionConfig();
    this.validateProductionConfig();
  }

  static getInstance(): ProductionConfigManager {
    if (!ProductionConfigManager.instance) {
      ProductionConfigManager.instance = new ProductionConfigManager();
    }
    return ProductionConfigManager.instance;
  }

  private createProductionConfig(): ProductionConfig {
    const isProduction = config.isProduction();
    
    return {
      server: {
        port: config.get('port'),
        host: process.env.HOST || '0.0.0.0',
        trustProxy: isProduction,
        keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000'),
        headersTimeout: parseInt(process.env.HEADERS_TIMEOUT || '66000')
      },
      security: {
        helmet: {
          contentSecurityPolicy: isProduction,
          crossOriginEmbedderPolicy: isProduction,
          crossOriginOpenerPolicy: isProduction,
          crossOriginResourcePolicy: isProduction,
          dnsPrefetchControl: true,
          frameguard: { action: 'deny' },
          hidePoweredBy: true,
          hsts: isProduction ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
          } : false,
          ieNoOpen: true,
          noSniff: true,
          originAgentCluster: true,
          permittedCrossDomainPolicies: false,
          referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
          xssFilter: true
        },
        cors: {
          origin: config.get('corsOrigins'),
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
          exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
          maxAge: 86400 // 24 hours
        },
        rateLimit: {
          windowMs: config.get('rateLimitWindowMs'),
          max: config.get('rateLimitMax'),
          message: {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests from this IP, please try again later.'
            }
          },
          standardHeaders: true,
          legacyHeaders: false
        }
      },
      performance: {
        compression: isProduction,
        etag: true,
        maxAge: isProduction ? 86400000 : 0, // 24 hours in production
        setHeaders: true,
        defer: true
      },
      monitoring: {
        enabled: true,
        level: config.get('logLevel'),
        format: isProduction ? 'json' : 'simple',
        colorize: !isProduction,
        timestamp: true,
        json: isProduction
      },
      database: {
        ssl: isProduction,
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
        reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000'),
        createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT || '30000'),
        destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT || '5000')
      },
      cache: {
        type: (process.env.CACHE_TYPE || 'memory') as any,
        ttl: parseInt(process.env.CACHE_TTL || '300000'),
        max: parseInt(process.env.CACHE_MAX || '1000'),
        updateAgeOnGet: false,
        checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600000'),
        redis: process.env.REDIS_HOST ? {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          keyPrefix: process.env.REDIS_KEY_PREFIX || 'gcp:'
        } : undefined
      },
      session: {
        secret: config.get('jwtSecret'),
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
          secure: isProduction,
          httpOnly: true,
          sameSite: 'strict' as const,
          maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'),
          path: '/',
          domain: process.env.COOKIE_DOMAIN
        },
        store: (process.env.SESSION_STORE || 'memory') as any
      },
      clustering: {
        enabled: process.env.CLUSTERING === 'true',
        workers: parseInt(process.env.CLUSTER_WORKERS || '0') || require('os').cpus().length,
        maxMemory: parseInt(process.env.CLUSTER_MAX_MEMORY || '1024'),
        gracefulShutdown: parseInt(process.env.CLUSTER_GRACEFUL_SHUTDOWN || '30000')
      }
    };
  }

  private validateProductionConfig(): void {
    if (config.isProduction()) {
      const requiredEnvVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'RESEND_API_KEY'
      ];

      const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

      if (missing.length > 0) {
        throw new Error(`Missing required environment variables for production: ${missing.join(', ')}`);
      }

      // Validate JWT secrets
      const jwtSecret = config.get('jwtSecret');
      const jwtRefreshSecret = config.get('jwtRefreshSecret');

      if (jwtSecret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long in production');
      }

      if (jwtRefreshSecret.length < 32) {
        throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long in production');
      }

      // Validate database URL
      const dbUrl = config.get('databaseUrl');
      if (!dbUrl.startsWith('postgresql://')) {
        throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
      }

      // Validate port
      const port = config.get('port');
      if (port < 1 || port > 65535) {
        throw new Error('PORT must be between 1 and 65535');
      }

      logger.info('Production configuration validated successfully');
    }
  }

  getConfig(): ProductionConfig {
    return { ...this.config };
  }

  getServerConfig() {
    return this.config.server;
  }

  getSecurityConfig() {
    return this.config.security;
  }

  getPerformanceConfig() {
    return this.config.performance;
  }

  getMonitoringConfig() {
    return this.config.monitoring;
  }

  getDatabaseConfig() {
    return this.config.database;
  }

  getCacheConfig() {
    return this.config.cache;
  }

  getSessionConfig() {
    return this.config.session;
  }

  getClusteringConfig() {
    return this.config.clustering;
  }

  // Environment-specific helpers
  isProduction(): boolean {
    return config.isProduction();
  }

  isDevelopment(): boolean {
    return config.isDevelopment();
  }

  isTest(): boolean {
    return config.isTest();
  }

  // Feature flags
  isFeatureEnabled(feature: string): boolean {
    const featureFlag = process.env[`FEATURE_${feature.toUpperCase()}`];
    return featureFlag === 'true';
  }

  // Get environment-specific URLs
  getClientUrl(): string {
    return config.get('clientUrl');
  }

  getServerUrl(): string {
    const protocol = this.isProduction() ? 'https' : 'http';
    const host = this.config.server.host;
    const port = this.config.server.port;
    
    return `${protocol}://${host}:${port}`;
  }

  getApiUrl(): string {
    return `${this.getServerUrl()}/api`;
  }

  // Health check configuration
  getHealthCheckConfig() {
    return {
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
      retries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3'),
      endpoints: {
        database: '/health/database',
        cache: '/health/cache',
        external: '/health/external'
      }
    };
  }

  // Metrics configuration
  getMetricsConfig() {
    return {
      enabled: this.config.monitoring.enabled,
      interval: parseInt(process.env.METRICS_INTERVAL || '60000'),
      retention: parseInt(process.env.METRICS_RETENTION || '86400000'), // 24 hours
      export: {
        prometheus: this.isFeatureEnabled('PROMETHEUS'),
        datadog: this.isFeatureEnabled('DATADOG'),
        newrelic: this.isFeatureEnabled('NEW_RELIC')
      }
    };
  }

  // Backup configuration
  getBackupConfig() {
    return {
      enabled: this.isFeatureEnabled('BACKUP'),
      schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
      retention: parseInt(process.env.BACKUP_RETENTION || '7'), // 7 days
      storage: {
        type: process.env.BACKUP_STORAGE_TYPE || 'local',
        bucket: process.env.BACKUP_S3_BUCKET,
        region: process.env.BACKUP_S3_REGION,
        accessKey: process.env.BACKUP_S3_ACCESS_KEY,
        secretKey: process.env.BACKUP_S3_SECRET_KEY
      }
    };
  }

  // Security configuration
  getSecurityHeaders() {
    return {
      'Strict-Transport-Security': this.isProduction() ? 
        'max-age=31536000; includeSubDomains; preload' : 
        'max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Content-Security-Policy': this.getCSPHeader()
    };
  }

  private getCSPHeader(): string {
    const directives = [
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
    ];

    return directives.join('; ');
  }
}

export const productionConfig = ProductionConfigManager.getInstance();

// Production environment checks
export function validateProductionEnvironment(): void {
  if (!config.isProduction()) {
    return;
  }

  const checks = [
    {
      name: 'Node.js version',
      check: () => {
        const version = process.version;
        const majorVersion = parseInt(version.slice(1).split('.')[0]);
        return majorVersion >= 18;
      },
      message: 'Node.js version must be 18 or higher'
    },
    {
      name: 'Memory available',
      check: () => {
        const memUsage = process.memoryUsage();
        const totalMem = require('os').totalmem();
        return totalMem >= 1024 * 1024 * 1024; // 1GB minimum
      },
      message: 'System must have at least 1GB of memory'
    },
    {
      name: 'Database connectivity',
      check: async () => {
        try {
          const { query } = require('../db/client');
          await query('SELECT 1');
          return true;
        } catch {
          return false;
        }
      },
      message: 'Database connection failed'
    },
    {
      name: 'Required services',
      check: () => {
        const requiredServices = ['STRIPE_SECRET_KEY', 'RESEND_API_KEY'];
        return requiredServices.every(service => process.env[service]);
      },
      message: 'All required external services must be configured'
    }
  ];

  for (const check of checks) {
    try {
      const result = await check.check();
      if (!result) {
        throw new Error(`Production validation failed: ${check.name} - ${check.message}`);
      }
      logger.info(`Production check passed: ${check.name}`);
    } catch (error) {
      logger.error(`Production check failed: ${check.name}`, { error: (error as Error).message });
      throw error;
    }
  }

  logger.info('All production environment checks passed');
}

// Production startup
export async function startProductionServer(): Promise<void> {
  if (config.isProduction()) {
    logger.info('Starting production server...');
    
    // Validate environment
    validateProductionEnvironment();
    
    // Start monitoring
    const { infrastructureMonitor } = require('../monitoring/infrastructure');
    infrastructureMonitor.startMonitoring();
    
    // Start alerting
    const { alertingSystem } = require('../monitoring/alerting');
    
    logger.info('Production server started successfully');
  }
}
