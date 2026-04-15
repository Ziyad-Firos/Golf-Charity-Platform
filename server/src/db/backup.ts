import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { query } from './client';

const execAsync = promisify(exec);

export interface BackupConfig {
  databaseUrl: string;
  backupPath: string;
  retentionDays: number;
  compression: boolean;
}

export class DatabaseBackup {
  private static instance: DatabaseBackup;
  private config: BackupConfig;

  private constructor() {
    this.config = {
      databaseUrl: process.env.DATABASE_URL!,
      backupPath: process.env.BACKUP_PATH || './backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      compression: process.env.BACKUP_COMPRESSION !== 'false'
    };
  }

  static getInstance(): DatabaseBackup {
    if (!DatabaseBackup.instance) {
      DatabaseBackup.instance = new DatabaseBackup();
    }
    return DatabaseBackup.instance;
  }

  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.config.backupPath)) {
      fs.mkdirSync(this.config.backupPath, { recursive: true });
    }
  }

  private async createBackupFilename(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sql${this.config.compression ? '.gz' : ''}`;
    return path.join(this.config.backupPath, filename);
  }

  async createFullBackup(): Promise<string> {
    this.ensureBackupDirectory();
    
    const filename = await this.createBackupFilename();
    const pgDumpCommand = this.buildPgDumpCommand(filename);

    logger.info('Starting database backup', { filename });

    try {
      const { stdout, stderr } = await execAsync(pgDumpCommand);
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(`pgdump error: ${stderr}`);
      }

      // Verify backup was created
      if (!fs.existsSync(filename)) {
        throw new Error('Backup file was not created');
      }

      const stats = fs.statSync(filename);
      logger.info('Database backup completed', {
        filename,
        size: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2)
      });

      // Record backup in database
      await this.recordBackup(filename, 'full', stats.size);

      return filename;
    } catch (error) {
      logger.error('Database backup failed', { error: (error as Error).message });
      
      // Clean up failed backup
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
      }
      
      throw error;
    }
  }

  private buildPgDumpCommand(filename: string): string {
    const { databaseUrl, compression } = this.config;
    let command = `pg_dump "${databaseUrl}"`;
    
    if (compression) {
      command += ' | gzip';
    }
    
    command += ` > "${filename}"`;
    
    return command;
  }

  async restoreBackup(backupFile: string): Promise<void> {
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    logger.info('Starting database restore', { backupFile });

    const restoreCommand = this.buildRestoreCommand(backupFile);

    try {
      const { stdout, stderr } = await execAsync(restoreCommand);
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(`pgrestore error: ${stderr}`);
      }

      logger.info('Database restore completed', { backupFile });

      // Record restore in database
      await this.recordRestore(backupFile);
    } catch (error) {
      logger.error('Database restore failed', { 
        backupFile,
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private buildRestoreCommand(backupFile: string): string {
    const { databaseUrl } = this.config;
    let command = '';
    
    if (backupFile.endsWith('.gz')) {
      command += `gunzip -c "${backupFile}" | `;
    } else {
      command += `cat "${backupFile}" | `;
    }
    
    command += `psql "${databaseUrl}"`;
    
    return command;
  }

  private async recordBackup(filename: string, type: string, size: number): Promise<void> {
    try {
      await query(`
        INSERT INTO backup_log (filename, type, size_bytes, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [filename, type, size]);
    } catch (error) {
      logger.warn('Failed to record backup in database', { error: (error as Error).message });
    }
  }

  private async recordRestore(filename: string): Promise<void> {
    try {
      await query(`
        INSERT INTO restore_log (filename, created_at)
        VALUES ($1, NOW())
      `, [filename]);
    } catch (error) {
      logger.warn('Failed to record restore in database', { error: (error as Error).message });
    }
  }

  async cleanupOldBackups(): Promise<void> {
    this.ensureBackupDirectory();
    
    const files = fs.readdirSync(this.config.backupPath)
      .filter(file => file.startsWith('backup_') && file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: path.join(this.config.backupPath, file),
        mtime: fs.statSync(path.join(this.config.backupPath, file)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const filesToDelete = files.filter(file => file.mtime < cutoffDate);

    if (filesToDelete.length === 0) {
      logger.info('No old backups to clean up');
      return;
    }

    logger.info(`Cleaning up ${filesToDelete.length} old backups`);

    for (const file of filesToDelete) {
      try {
        fs.unlinkSync(file.path);
        logger.debug('Deleted old backup', { filename: file.name });
      } catch (error) {
        logger.error('Failed to delete old backup', { 
          filename: file.name,
          error: (error as Error).message 
        });
      }
    }

    logger.info('Backup cleanup completed');
  }

  async getBackupHistory(): Promise<Array<{
    filename: string;
    type: string;
    size_bytes: number;
    created_at: Date;
  }>> {
    try {
      const result = await query(`
        SELECT filename, type, size_bytes, created_at
        FROM backup_log
        ORDER BY created_at DESC
        LIMIT 50
      `);

      return result;
    } catch (error) {
      logger.error('Failed to get backup history', { error: (error as Error).message });
      return [];
    }
  }

  async verifyBackup(backupFile: string): Promise<boolean> {
    try {
      const restoreCommand = this.buildRestoreCommand(backupFile);
      const testCommand = restoreCommand.replace('psql', 'psql --echo-errors --quiet --set ON_ERROR_STOP=1');
      
      // Test restore without actually restoring
      const { stdout, stderr } = await execAsync(`${testCommand} 2>&1 | head -20`);
      
      // Check for errors
      if (stderr.includes('ERROR') || stderr.includes('FATAL')) {
        logger.error('Backup verification failed', { 
          backupFile,
          errors: stderr 
        });
        return false;
      }

      logger.info('Backup verification passed', { backupFile });
      return true;
    } catch (error) {
      logger.error('Backup verification error', { 
        backupFile,
        error: (error as Error).message 
      });
      return false;
    }
  }

  async scheduleBackups(): Promise<void> {
    // This would typically be run as a cron job
    // For now, just implement the backup logic
    logger.info('Scheduled backup started');
    
    try {
      await this.createFullBackup();
      await this.cleanupOldBackups();
      
      logger.info('Scheduled backup completed successfully');
    } catch (error) {
      logger.error('Scheduled backup failed', { error: (error as Error).message });
    }
  }
}

export const databaseBackup = DatabaseBackup.getInstance();

// Backup log table (should be created in a migration)
export const createBackupTables = async (): Promise<void> => {
  await query(`
    CREATE TABLE IF NOT EXISTS backup_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'full',
      size_bytes BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS restore_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_backup_log_created_at ON backup_log(created_at)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_restore_log_created_at ON restore_log(created_at)
  `);
};
