# PostgreSQL backup and restore

Use provider-managed encrypted backups where available and retain an independent logical backup before every schema deployment. Never place dumps or credentials in this repository.

For each backup, record the database identifier, UTC timestamp, tool/provider, encryption status, retention date, and checksum or provider job ID. A backup is not verified until restored to an isolated database and checked with `npx prisma migrate status`, representative row counts, tenant isolation queries, and an application smoke test.

Restore drills must record start/end time, recovery point, recovery duration, operator, evidence links, and discrepancies. Production restore is destructive: stop writes, confirm the exact target and backup, obtain explicit approval, retain the failed database for investigation, then verify authentication, tenant data, billing records, and audit history.
