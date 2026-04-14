// ===========================================
// Database Configuration (Prisma Client)
// ===========================================

import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: config.nodeEnv === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
  });
};

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (config.nodeEnv !== 'production') {
  globalThis.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
