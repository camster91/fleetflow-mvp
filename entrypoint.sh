#!/bin/sh
set -e

# Enforce DATABASE_URL in production — no silent SQLite fallback
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set."
  echo "FleetFlow requires a PostgreSQL database in production."
  echo "Set DATABASE_URL to your PostgreSQL connection string, e.g.:"
  echo "  postgresql://user:password@host:5432/fleetflow"
  echo ""
  echo "Refusing to start with a SQLite fallback."
  exit 1
fi

echo "Starting FleetFlow with database: ${DATABASE_URL%%\?*}"  # log URL without query params

# Run Prisma migrations (idempotent)
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node server.js
