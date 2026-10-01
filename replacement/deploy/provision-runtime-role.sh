#!/bin/sh
set -eu
printf '%s' "${PGDATABASE:-}" | grep -Eq '^fleetvera_rebuild_[a-z0-9_]+$' || { echo 'Dedicated rebuild database required' >&2; exit 64; }
printf '%s' "${RUNTIME_PASSWORD:-}" | grep -Eq '^[a-f0-9]{64}$' || { echo 'Runtime credential format rejected' >&2; exit 64; }
if ! psql -v ON_ERROR_STOP=1 -v database_name="$PGDATABASE" -v runtime_password="$RUNTIME_PASSWORD" -f /runtime-role.sql >/dev/null 2>&1; then
  echo 'Runtime role provisioning failed; inspect privately' >&2
  exit 1
fi
echo 'Dedicated runtime role verified'
