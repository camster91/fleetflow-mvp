# Use Node.js LTS Alpine as base
FROM node:20-alpine AS builder

# Install dependencies for building
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and create the SQLite DB with schema applied
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

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create data directory
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy the pre-built SQLite database (empty schema, tables ready)
COPY --from=builder --chown=nextjs:nodejs /app/data/fleet.db /app/data/fleet.db

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

# Start the application
CMD ["node", "server.js"]
