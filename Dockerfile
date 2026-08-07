# Use Node.js LTS Alpine as base
FROM node:20-alpine AS builder

# Install dependencies for building
RUN apk add --no-cache libc6-compat openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
ENV NEXTAUTH_URL=http://localhost:3000
# No SQLite fallback — DATABASE_URL must be explicitly set in production
ENV DATABASE_URL=postgresql://fleetflow:build-only@localhost:5432/fleetflow

RUN npm run build

# Production image
FROM node:20-alpine AS runner

# Install curl for health checks and openssl for Prisma
RUN apk add --no-cache curl openssl

# Install Prisma CLI globally for migrations
RUN npm install -g prisma@5

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/create-admin.js ./create-admin.js

# Copy entrypoint script that enforces DATABASE_URL in production
COPY --chown=nextjs:nodejs entrypoint.sh ./
RUN sed -i 's/\r$//' entrypoint.sh && chmod 755 entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the app via entrypoint (validates DATABASE_URL before launching)
CMD ["./entrypoint.sh"]
