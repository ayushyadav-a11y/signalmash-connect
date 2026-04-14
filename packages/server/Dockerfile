# =============================================
# SignalMash Connect - Server Dockerfile
# =============================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY tsconfig.base.json ./

# Build shared package
WORKDIR /app/packages/shared
RUN yarn build

# Build server
WORKDIR /app/packages/server
RUN yarn build

# Generate Prisma client
RUN npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install production dependencies only
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/packages/server/node_modules/.prisma ./packages/server/node_modules/.prisma

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

WORKDIR /app/packages/server

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
