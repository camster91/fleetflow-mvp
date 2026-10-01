# Checked Fleetvera images

`Rebuild checks` builds the runtime and database-role images once. The runtime
image executes the API/security/currency suite against its own fresh database,
using the checked test files mounted read-only. Both images carry the complete
source revision and run as unprivileged users.

`checked-image.py` exports Docker saves with distinct revision-specific import
tags and receipts bound to repository, image kind, source SHA, workflow run and
attempt. It verifies archive checksums, configuration identity, command/user and
image entries before import. Loaded configuration, filesystem layers and platform
must match even when different Docker engines report manifest/configuration IDs.

Browser CI downloads those artifacts instead of rebuilding. It uses the archived
role initializer twice, migrates with the archived runtime twice, boots that same
runtime with the restricted database role, exercises Chromium flows and verifies
reconnection after PostgreSQL restart without restarting the app container.

Only successful `main` push checks with
`FLEETVERA_IMMUTABLE_RELEASE_ENABLED=true` can publish. Publication waits for both
image and browser jobs, verifies/loads the same archives, and pushes their existing
image IDs to GHCR without rebuilding. Each receipt records an immutable registry
digest. App/migration and role-init digests must be released together.

The activation variable is currently false. The repository still defaults to
`master`; no branch settings or legacy deployment were changed by this preparation.
Registry publication and actual production promotion have not been exercised.
The reviewed production target, fresh production database,
off-server pre-release backup gate, registry read access, protected main merge
policy and public/authenticated acceptance remain required before live auto-deploys.

The staging Compose now uses the versioned role-image entrypoint; it validates a
dedicated rebuild database and a 64-hex runtime password, supplies the database
identifier safely to psql and suppresses secret-bearing failure details. Existing
staging remains on its previously verified source until explicitly updated.

`coolify-release.mjs` prepares the production consumer and
`docker-compose.rebuild-production.json` defines its image-only Compose contract.
App and migration share the checked runtime digest; role provisioning uses the
paired checked role digest. PostgreSQL uses a separate production database and
volume. The consumer verifies production environment/server/destination identity,
disabled competing triggers, exact Compose/route, owner/runtime credential
separation and secure-cookie configuration before any write. It requires same-run
main release receipts and a fresh, nonce-bound production recovery proof with
manifest/content/runtime restore checks and a checksum-verified encrypted runner
copy. It refetches both image pins and unchanged settings before queueing once,
observes that exact handle, then verifies public database readiness, revision and
anonymous private-API denial. Failure/timeout never queues a replacement.

Consumer tests use simulated API responses and temporary encrypted-copy fixtures;
they do not establish real Coolify promotion or production recovery. The backup
producer/transport for this production proof is still required. No consumer
workflow is enabled or wired to deployment yet. It is intentionally unable to
use a staging backup or deploy a source-built staging resource. Production setup
must choose the reviewed canonical route, preserve the established proxy owner,
enroll registry/backup access and verify the actual deployment before activation.
