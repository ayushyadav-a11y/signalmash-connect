// ===========================================
// Redis Configuration
// ===========================================

import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('✅ Connected to Redis');
});

redis.on('error', (err) => {
  logger.error({ err }, '❌ Redis connection error');
});

// Create a duplicate connection for subscribers (BullMQ requirement)
export const createRedisConnection = () => {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};
