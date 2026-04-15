import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { errorHandler, notFound } from './middleware/error.middleware';
import { requestIdMiddleware } from './utils/logger';
import { logger } from './utils/logger';
import { metrics, metricsMiddleware } from './utils/metrics';
import { checkDatabaseHealth, getPoolStats } from './db/client';
import { databaseMonitor } from './db/monitoring';

const app = express();

// Request ID middleware
app.use(requestIdMiddleware);

// Metrics middleware
app.use(metricsMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Security headers
app.use(helmet());

// CORS — allow all origins in production, restrict in development
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' 
      ? true 
      : (process.env.CLIENT_URL || 'http://localhost:5173'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser (needed for HttpOnly refresh token)
app.use(cookieParser());

// Health check
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      requestId: req.requestId,
      responseTime: Date.now() - startTime
    };

    // Check database health
    const dbHealth = await checkDatabaseHealth();
    const poolStats = getPoolStats();
    
    healthCheck.database = {
      connected: dbHealth.connected,
      connectionCount: dbHealth.totalConnections,
      idleConnections: dbHealth.idleConnections,
      waitingConnections: dbHealth.waitingConnections,
      averageQueryTime: dbHealth.averageQueryTime
    };

    healthCheck.connectionPool = poolStats;

    logger.info('Health check accessed', {
      requestId: req.requestId,
      ip: req.ip,
      dbConnected: dbHealth.connected
    });

    // Return 200 if all is well, 503 if database is down
    const statusCode = dbHealth.connected ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed', {
      requestId: req.requestId,
      error: (error as Error).message
    });

    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      requestId: req.requestId,
      responseTime: Date.now() - startTime
    });
  }
});

// Database health check endpoint
app.get('/api/health/database', async (req, res) => {
  try {
    const detailedReport = await databaseMonitor.getDetailedReport();
    const healthCheck = await databaseMonitor.runHealthCheck();
    
    logger.info('Database health check accessed', {
      requestId: req.requestId,
      status: healthCheck.status,
      score: healthCheck.overallScore
    });

    res.json({
      ...healthCheck,
      ...detailedReport,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Database health check failed', {
      requestId: req.requestId,
      error: (error as Error).message
    });

    res.status(500).json({
      status: 'error',
      error: 'Database health check failed',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }
});

// Metrics endpoint (for monitoring)
app.get('/api/metrics', (req, res) => {
  const metricsData = {
    ...metrics.getMetrics(),
    endpoints: metrics.getEndpointMetrics(),
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  };

  logger.info('Metrics accessed', {
    requestId: req.requestId,
    ip: req.ip
  });

  res.json(metricsData);
});

// API routes
app.use(routes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

export default app;
