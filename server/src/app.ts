// @ts-nocheck
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes';

const app = express();

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
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use(routes);

export default app;
