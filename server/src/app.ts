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
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    requestId: req.requestId
  };

  logger.info('Health check accessed', {
    requestId: req.requestId,
    ip: req.ip
  });

  res.json(healthCheck);
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
