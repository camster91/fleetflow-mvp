# Deploy and rollback

## Prepare

1. Record the candidate commit SHA and successful GitHub CI run.
2. In the exact production environment, run `FLEETVERA_RELEASE_MODE=pilot npm run verify:production-config` (or `public` for public launch). It prints only missing configuration names and must pass before deployment.
3. Confirm the production environment approval and all release-readiness checks.
4. Create and verify a database backup. Record its identifier, timestamp, and restore test.
5. Build or identify the immutable application image for the candidate SHA. Supply `NEXT_PUBLIC_SENTRY_DSN` as a build argument; it must match the runtime value because the browser bundle and CSP are generated at build time.
6. Complete the monitoring setup and evidence checklist in `docs/runbooks/monitoring.md`.
7. Confirm whether the database is new or already contains FleetFlow tables.
7. For a controlled pilot, configure authenticated schedules for the existing retention endpoints, including `POST /api/cron/pilot-retention` with `X-Cron-Secret`. Confirm schedules call the candidate's HTTPS origin and retain only status/aggregate evidence.

For a new database, `prisma migrate deploy` applies the committed PostgreSQL baseline. For an existing database, first compare it with `prisma migrate diff`, back it up, and rehearse on a restored copy. Mark the baseline as applied with `prisma migrate resolve --applied 20260807000000_postgresql_baseline` only when the restored schema is confirmed equivalent. This command changes migration state and requires explicit production approval.

## Deploy

1. Manually run `Deploy to Coolify` with the full approved `master` SHA.
2. Approve the protected production environment.
3. Observe migration and application startup logs without printing secret values.
4. Verify health, login/2FA, workspace selection, one read/write workflow, billing status, and the controlled client/server monitoring events.
5. Confirm the health and error alerts reach the approved destination and are acknowledged by the named responder.
6. Record the deployment ID, image digest, timestamps, monitoring event IDs, alert evidence, and smoke-test evidence.

## Roll back

Application rollback means redeploying the last known-good immutable image. Do not reverse a database migration automatically. If the new application wrote incompatible data, stop writes, preserve logs, and restore the verified backup into an isolated database before an approved production restore.

Rollback triggers include failed health checks, authentication failure, cross-tenant exposure, migration failure, elevated server errors, or incorrect billing events. Record the trigger, decision owner, restored version, database action, and post-rollback verification.
