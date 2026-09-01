# PostgreSQL backup and restore

Use provider-managed encrypted backups where available and retain an independent logical backup before every schema deployment. Never place dumps or credentials in this repository.

## Verified logical backup drill

On a trusted Linux operations host with Docker, use the fail-closed verifier to create an encrypted logical backup and restore it into a fresh, unported PostgreSQL 16 container:

```bash
export FLEETVERA_BACKUP_ENCRYPTION_KEY='stored-in-the-operations-secret-manager'
npm run verify:backup-restore -- --source-container fleetflow-postgres --backup-dir /opt/fleetflow/backups
```

The command refuses a missing or short encryption key, a relative backup directory, an unsafe container name, or a missing source container. It writes only an AES-256-CBC/PBKDF2 encrypted backup plus metadata containing the timestamp, checksum, size, critical-table aggregate counts, completed/failed migration counts, and ownership/relation integrity counts. It never logs database rows, credentials, or the passphrase. The restore target is randomly named, has no host port, and is removed in a `finally` cleanup path. A failed restore or structural check deletes the partial artifact instead of promoting it as a verified backup.

Store the passphrase outside the VPS and test a separately retained backup with a different recovery operator before treating this as durable disaster-recovery evidence.

For each backup, record the database identifier, UTC timestamp, tool/provider, encryption status, retention date, and checksum or provider job ID. The verifier proves that the encrypted dump restores, required tables and completed migrations are present, migrations are not unfinished, critical source-versus-restore row counts match (including a legitimately empty pilot), and team ownership/references are internally consistent. It intentionally does not prove recovery timing, application behavior, or tenant-level business-record completeness. Those still require the separately retained artifact, `npx prisma migrate status`, tenant isolation queries, and an authenticated application smoke test.

Restore drills must record start/end time, recovery point, recovery duration, operator, evidence links, and discrepancies. Production restore is destructive: stop writes, confirm the exact target and backup, obtain explicit approval, retain the failed database for investigation, then verify authentication, tenant data, billing records, and audit history.
