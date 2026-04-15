import { logger } from '../utils/logger';
import { query } from '../db/client';

export interface ValidationResult {
  status: 'pass' | 'fail' | 'warning';
  message: string;
  issues: string[];
}

export class FinalValidator {
  static async validateSystem(): Promise<ValidationResult> {
    const issues: string[] = [];
    
    // Check environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'STRIPE_SECRET_KEY',
      'RESEND_API_KEY'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        issues.push(`Missing required environment variable: ${envVar}`);
      }
    }

    // Check JWT secrets
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      issues.push('JWT_SECRET must be at least 32 characters long');
    }

    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (jwtRefreshSecret && jwtRefreshSecret.length < 32) {
      issues.push('JWT_REFRESH_SECRET must be at least 32 characters long');
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      issues.push(`Node.js version ${nodeVersion} is too old. Minimum required: v18.0.0`);
    }

    const status = issues.length === 0 ? 'pass' : issues.length > 5 ? 'fail' : 'warning';
    const message = status === 'pass' ? 'System validation passed' : `Found ${issues.length} issue(s)`;

    return {
      status,
      message,
      issues
    };
  }

  static async validateDatabase(): Promise<ValidationResult> {
    const issues: string[] = [];
    
    try {
      await query('SELECT 1');
    } catch (error) {
      issues.push(`Database connection failed: ${(error as Error).message}`);
    }

    const status = issues.length === 0 ? 'pass' : 'fail';
    const message = status === 'pass' ? 'Database validation passed' : 'Database validation failed';

    return {
      status,
      message,
      issues
    };
  }

  static async validateServices(): Promise<ValidationResult> {
    const issues: string[] = [];
    
    // Check Stripe
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
      issues.push('Stripe secret key is not configured or invalid');
    }

    // Check Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || !resendApiKey.startsWith('re_')) {
      issues.push('Resend API key is not configured or invalid');
    }

    const status = issues.length === 0 ? 'pass' : 'warning';
    const message = status === 'pass' ? 'Services validation passed' : 'Services validation has warnings';

    return {
      status,
      message,
      issues
    };
  }

  static async runFullValidation(): Promise<{
    overall: 'pass' | 'fail' | 'warning';
    results: {
      system: ValidationResult;
      database: ValidationResult;
      services: ValidationResult;
    };
  }> {
    const [system, database, services] = await Promise.all([
      this.validateSystem(),
      this.validateDatabase(),
      this.validateServices()
    ]);

    const allIssues = [...system.issues, ...database.issues, ...services.issues];
    const overall = allIssues.length === 0 ? 'pass' : 
                   database.status === 'fail' || system.status === 'fail' ? 'fail' : 'warning';

    return {
      overall,
      results: {
        system,
        database,
        services
      }
    };
  }
}

export const finalValidator = FinalValidator;
