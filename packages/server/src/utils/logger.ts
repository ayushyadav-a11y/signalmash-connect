// ===========================================
// Logger Configuration (Pino)
// ===========================================

import pino from 'pino';
import { config } from '../config/index.js';

const isDevelopment = config.nodeEnv === 'development';

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: config.nodeEnv,
  },
  redact: {
    paths: [
      'password',
      'passwordHash',
      'accessToken',
      'refreshToken',
      'token',
      'secret',
      'apiKey',
      'authorization',
      'cookie',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
