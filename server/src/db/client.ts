import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

console.log('Database URL:', process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***:***@'));

// Enhanced pool configuration
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  min: 5,  // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
};

const pool = new Pool(poolConfig);

// Pool event monitoring
pool.on('connect', (client) => {
  logger.info('New database client connected', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

pool.on('acquire', (client) => {
  logger.debug('Database client acquired', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

pool.on('remove', (client) => {
  logger.info('Database client removed', {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  });
});

pool.on('error', (err, client) => {
  logger.error('Database pool error', {
    error: err.message,
    stack: err.stack
  });
});

// Enhanced query function with monitoring
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  const queryId = Math.random().toString(36).substring(7);
  
  try {
    logger.debug('Database query started', {
      queryId,
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params: params?.length || 0
    });

    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log successful query
    logger.debug('Database query completed', {
      queryId,
      duration,
      rows: res.rowCount,
      success: true
    });

    // Record metrics
    metrics.recordRequest(`DB_${text.split(' ')[0]}`, duration, true);
    
    // Log slow queries
    if (duration > 1000) {
      logger.warn('Slow database query detected', {
        queryId,
        duration,
        query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        params: params?.length || 0
      });
    }

    return res;
  } catch (error) {
    const duration = Date.now() - start;
    
    // Log failed query
    logger.error('Database query failed', {
      queryId,
      duration,
      error: (error as Error).message,
      query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      params: params?.length || 0,
      success: false
    });

    // Record metrics
    metrics.recordRequest(`DB_${text.split(' ')[0]}`, duration, false);
    
    throw error;
  }
};

// Transaction support
export const transaction = async <T>(
  callback: (client: any) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  const start = Date.now();
  
  try {
    await client.query('BEGIN');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    
    const duration = Date.now() - start;
    logger.info('Database transaction completed', {
      duration,
      success: true
    });
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    
    const duration = Date.now() - start;
    logger.error('Database transaction failed', {
      duration,
      error: (error as Error).message,
      success: false
    });
    
    throw error;
  } finally {
    client.release();
  }
};

// Health check for database
export const checkDatabaseHealth = async (): Promise<{
  connected: boolean;
  totalConnections: number;
  idleConnections: number;
  waitingConnections: number;
  averageQueryTime?: number;
}> => {
  try {
    const start = Date.now();
    await query('SELECT 1');
    const duration = Date.now() - start;
    
    return {
      connected: true,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount,
      averageQueryTime: duration
    };
  } catch (error) {
    logger.error('Database health check failed', {
      error: (error as Error).message
    });
    
    return {
      connected: false,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount
    };
  }
};

// Graceful shutdown
export const closeDatabasePool = async (): Promise<void> => {
  logger.info('Closing database connection pool');
  await pool.end();
  logger.info('Database connection pool closed');
};

// Pool statistics
export const getPoolStats = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount
});

export default pool;
