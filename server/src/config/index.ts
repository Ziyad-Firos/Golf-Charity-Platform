export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  clientUrl: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  resendApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  bcryptCost: number;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

class Config {
  private static instance: Config;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private loadConfig(): AppConfig {
    return {
      port: parseInt(process.env.PORT || '3001', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      databaseUrl: process.env.DATABASE_URL || '',
      jwtSecret: process.env.JWT_SECRET || '',
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
      clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
      stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      resendApiKey: process.env.RESEND_API_KEY || '',
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      bcryptCost: parseInt(process.env.BCRYPT_COST || '12', 10),
      accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
      refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
      corsOrigins: this.parseCorsOrigins(process.env.CORS_ORIGINS),
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      logLevel: (process.env.LOG_LEVEL as any) || 'info'
    };
  }

  private parseCorsOrigins(origins?: string): string[] {
    if (!origins) {
      return this.config?.nodeEnv === 'production' ? [] : ['http://localhost:5173'];
    }
    return origins.split(',').map(origin => origin.trim());
  }

  private validateConfig(): void {
    const requiredFields = [
      'databaseUrl',
      'jwtSecret',
      'jwtRefreshSecret',
      'stripeSecretKey',
      'stripeWebhookSecret',
      'resendApiKey'
    ];

    const missingFields = requiredFields.filter(field => !this.config[field as keyof AppConfig]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required environment variables: ${missingFields.join(', ')}`);
    }

    // Validate port
    if (isNaN(this.config.port) || this.config.port < 1 || this.config.port > 65535) {
      throw new Error('Invalid PORT configuration');
    }

    // Validate bcrypt cost
    if (this.config.bcryptCost < 10 || this.config.bcryptCost > 15) {
      throw new Error('BCRYPT_COST must be between 10 and 15');
    }
  }

  isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }
}

export const config = Config.getInstance();
