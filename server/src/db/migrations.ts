import fs from 'fs';
import path from 'path';
import { query } from './client';

export interface Migration {
  id: string;
  name: string;
  sql: string;
  applied_at?: Date;
}

export class MigrationManager {
  private static instance: MigrationManager;
  private migrationsPath: string;

  private constructor() {
    this.migrationsPath = path.join(__dirname, '../../migrations');
  }

  static getInstance(): MigrationManager {
    if (!MigrationManager.instance) {
      MigrationManager.instance = new MigrationManager();
    }
    return MigrationManager.instance;
  }

  private async ensureMigrationTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async getAppliedMigrations(): Promise<Set<string>> => {
    const result = await query<{ id: string }>('SELECT id FROM schema_migrations');
    return new Set(result.map(row => row.id));
  }

  private async getMigrationFiles(): Promise<Migration[]> {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure consistent order

    return files.map(file => {
      const filePath = path.join(this.migrationsPath, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const id = file.replace('.sql', '');
      const name = this.extractMigrationName(sql);

      return { id, name, sql };
    });
  }

  private extractMigrationName(sql: string): string {
    const match = sql.match(/^--\s*(.+)/m);
    return match ? match[1].trim() : 'Unnamed migration';
  }

  async migrate(): Promise<void> {
    await this.ensureMigrationTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    
    const pendingMigrations = migrationFiles.filter(
      migration => !appliedMigrations.has(migration.id)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Applying ${pendingMigrations.length} migrations...`);

    for (const migration of pendingMigrations) {
      await this.applyMigration(migration);
    }

    console.log('All migrations applied successfully');
  }

  private async applyMigration(migration: Migration): Promise<void> {
    console.log(`Applying migration: ${migration.name}`);

    try {
      // Start transaction
      await query('BEGIN');

      // Apply migration SQL
      await query(migration.sql);

      // Record migration
      await query(
        'INSERT INTO schema_migrations (id, name) VALUES ($1, $2)',
        [migration.id, migration.name]
      );

      // Commit transaction
      await query('COMMIT');

      console.log(`Migration applied: ${migration.name}`);
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      console.error(`Migration failed: ${migration.name}`, error);
      throw error;
    }
  }

  async rollback(targetId?: string): Promise<void> {
    await this.ensureMigrationTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    
    const appliedMigrationFiles = migrationFiles.filter(
      migration => appliedMigrations.has(migration.id)
    ).reverse(); // Reverse order for rollback

    const targetIndex = targetId 
      ? appliedMigrationFiles.findIndex(m => m.id === targetId)
      : appliedMigrationFiles.length - 2; // Rollback to previous migration by default

    if (targetIndex === -1) {
      throw new Error(`Migration ${targetId} not found or not applied`);
    }

    const migrationsToRollback = appliedMigrationFiles.slice(0, targetIndex + 1);

    if (migrationsToRollback.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    console.log(`Rolling back ${migrationsToRollback.length} migrations...`);

    for (const migration of migrationsToRollback) {
      await this.rollbackMigration(migration);
    }

    console.log('Rollback completed successfully');
  }

  private async rollbackMigration(migration: Migration): Promise<void> {
    console.log(`Rolling back migration: ${migration.name}`);

    try {
      // Start transaction
      await query('BEGIN');

      // Remove migration record
      await query('DELETE FROM schema_migrations WHERE id = $1', [migration.id]);

      // Note: Actual rollback SQL would need to be implemented
      // This is a simplified version that just removes the migration record
      // In a real implementation, you'd need to generate rollback SQL

      // Commit transaction
      await query('COMMIT');

      console.log(`Migration rolled back: ${migration.name}`);
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      console.error(`Rollback failed: ${migration.name}`, error);
      throw error;
    }
  }

  async status(): Promise<{
    applied: Migration[];
    pending: Migration[];
  }> {
    await this.ensureMigrationTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    
    const applied = migrationFiles.filter(
      migration => appliedMigrations.has(migration.id)
    );

    const pending = migrationFiles.filter(
      migration => !appliedMigrations.has(migration.id)
    );

    return { applied, pending };
  }

  async createMigration(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    const id = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const filename = `${id}.sql`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = `-- Migration: ${name}
-- Generated: ${new Date().toISOString()}
-- Description: ${name}

-- Add your migration SQL here

`;

    fs.writeFileSync(filepath, template);
    console.log(`Migration created: ${filename}`);
    
    return filename;
  }
}

export const migrationManager = MigrationManager.getInstance();
