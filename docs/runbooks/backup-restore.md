# PostgreSQL backup and restore

Use provider-managed encrypted backups where available and retain an independent logical backup before every schema deployment. Never place dumps or credentials in this repository.

## Verified logical backup drill

On a trusted Linux operations host with Docker, use the fail-closed verifier to create an encrypted logical backup and restore it into a fresh, unported PostgreSQL 16 container:

```bash
export FLEETVERA_BACKUP_ENCRYPTION_KEY='stored-in-the-operations-secret-manager'
npm run verify:backup-restore -- --source-container fleetflow-postgres --backup-dir /opt/fleetflow/backups
```

The command refuses a missing or short encryption key, a relative backup directory, an unsafe container name, or a missing source container. It writes only an AES-256-CBC/PBKDF2 encrypted backup plus metadata containing the timestamp, checksum, size, and aggregate restore checks. It never logs database rows, credentials, or the passphrase. The restore target is randomly named, has no host port, and is removed in a `finally` cleanup path.

Store the passphrase outside the VPS and test a separately retained backup with a different recovery operator before treating this as durable disaster-recovery evidence.

For each backup, record the database identifier, UTC timestamp, tool/provider, encryption status, retention date, and checksum or provider job ID. A backup is not verified until restored to an isolated database and checked with `npx prisma migrate status`, representative row counts, tenant isolation queries, and an application smoke test.

Restore drills must record start/end time, recovery point, recovery duration, operator, evidence links, and discrepancies. Production restore is destructive: stop writes, confirm the exact target and backup, obtain explicit approval, retain the failed database for investigation, then verify authentication, tenant data, billing records, and audit history.
