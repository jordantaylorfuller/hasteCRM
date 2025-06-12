# Production Dockerfile for hasteCRM API
# Multi-stage build for optimal image size and security

# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:18.19.0-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ==========================================
# Stage 2: Builder
# ==========================================
FROM node:18.19.0-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY . .

# Generate Prisma client
WORKDIR /app/packages/database
RUN pnpm prisma generate

# Build the application
WORKDIR /app
RUN pnpm build --filter=api

# ==========================================
# Stage 3: Production Runner
# ==========================================
FROM node:18.19.0-alpine AS runner
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app

# Install production dependencies only
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

# Copy package files
COPY --chown=nestjs:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=nestjs:nodejs apps/api/package.json ./apps/api/
COPY --chown=nestjs:nodejs packages/database/package.json ./packages/database/
COPY --chown=nestjs:nodejs packages/shared/package.json ./packages/shared/
COPY --chown=nestjs:nodejs packages/types/package.json ./packages/types/

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/types/dist ./packages/types/dist

# Copy Prisma files
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder --chown=nestjs:nodejs /app/packages/database/node_modules/.prisma ./packages/database/node_modules/.prisma

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "apps/api/dist/main.js"]