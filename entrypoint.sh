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

echo "Database configuration detected."

case "${FLEETVERA_RELEASE_MODE:-}" in
  pilot|public)
    ;;
  *)
    echo "ERROR: FLEETVERA_RELEASE_MODE must be explicitly set to pilot or public."
    echo "Refusing to infer a weaker release mode."
    exit 1
    ;;
esac

# Validate the exact runtime configuration before any database mutation.
echo "Verifying ${FLEETVERA_RELEASE_MODE} release configuration..."
if [ "${FLEETVERA_DEMO_MODE:-}" = "true" ]; then
  node ./verify-demo-config.cjs
else
  node ./verify-production-readiness.cjs
fi
echo "Release configuration verified."

# Run Prisma migrations (idempotent)
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec node server.js
