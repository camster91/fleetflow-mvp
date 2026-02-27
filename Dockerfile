# Use Node.js LTS Alpine as base
FROM node:20-alpine AS builder

# Install dependencies for building
RUN apk add --no-cache libc6-compat openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and create the SQLite DB template with schema applied
RUN mkdir -p /app/data
RUN DATABASE_URL="file:/app/data/fleet.db" npx prisma generate
RUN DATABASE_URL="file:/app/data/fleet.db" npx prisma db push --accept-data-loss

# Build the application
RUN DATABASE_URL="file:/app/data/fleet.db" \
    NEXTAUTH_SECRET="build-placeholder-secret" \
    NEXTAUTH_URL="https://fleet.ashbi.ca" \
    npm run build

# Production image
FROM node:20-alpine AS runner

# Install curl for health checks + openssl for Prisma query engine
RUN apk add --no-cache curl openssl

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create data directory (will be overridden by Docker volume on startup)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Explicitly copy Prisma engine binaries (query engine for runtime)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy the DB as a template (outside /app/data so the volume doesn't shadow it)
COPY --from=builder --chown=nextjs:nodejs /app/data/fleet.db /app/fleet.db.template

# Copy startup script
COPY --chown=nextjs:nodejs start.sh /app/start.sh
RUN chmod +x /app/start.sh

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

# Start via script that initializes DB if needed
CMD ["/app/start.sh"]
