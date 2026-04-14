// ===========================================
// Signalmash Connect - API Server Entry Point
// ===========================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { prisma } from './config/database.js';
import { redis } from './config/redis.js';
import { logger } from './utils/logger.js';
import { apiRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Allow iframe embedding for GHL Custom Pages
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameSrc: ["'self'"],
      frameAncestors: ["'self'", 'https://*.gohighlevel.com', 'https://*.leadconnectorhq.com'],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [
    config.webUrl,
    /\.gohighlevel\.com$/,
    /\.leadconnectorhq\.com$/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
  skip: (req) => req.url === '/api/health',
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});

app.use('/api', limiter);

// API Routes
app.use('/api', apiRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Close database connection
  await prisma.$disconnect();
  logger.info('Database connection closed');

  // Close Redis connection
  await redis.quit();
  logger.info('Redis connection closed');

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`🚀 Signalmash Connect API running on port ${PORT}`);
  logger.info(`📚 Environment: ${config.nodeEnv}`);
  logger.info(`🌐 API URL: ${config.apiUrl}`);
  logger.info(`💻 Web URL: ${config.webUrl}`);
});

export { app };
