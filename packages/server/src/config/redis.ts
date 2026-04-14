// ===========================================
// Redis Configuration
// ===========================================

import IORedis from 'ioredis';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

const Redis = IORedis.default || IORedis;

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('✅ Connected to Redis');
});

redis.on('error', (err: Error) => {
  logger.error({ err }, '❌ Redis connection error');
});

// Create a duplicate connection for subscribers (BullMQ requirement)
export const createRedisConnection = () => {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};
