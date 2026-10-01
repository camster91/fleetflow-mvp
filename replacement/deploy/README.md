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

Both activation variables are currently false. A new `main` branch has been
prepared from the verified replacement source; the repository still defaults to
`master` during transition. Existing legacy deployment remains unchanged.
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
producer/transport is prepared in `server/ci-backup.py` and
`production-backup.mjs`, but production enrollment and its real proof remain
required. The workflow `rebuild-coolify-release.yml` is wired but disabled by both
activation variables. It is intentionally unable to
use a staging backup or deploy a source-built staging resource. Production setup
must choose the reviewed canonical route, preserve the established proxy owner,
enroll registry/backup access and verify the actual deployment before activation.

The server helper must be installed as root-owned code with a separate restricted
deployment key and root-private `/etc/fleetvera-ci-backup.json` containing exactly
the reviewed `resource_uuid` and `database=fleetvera_rebuild_production`. Never
reuse or copy the operator key. Its forced command accepts only
`fleetvera-backup <40-hex-release> <32-hex-nonce> <numeric-workflow-id>` and SCP
downloads of verified encrypted production archives. Uploads, shells, arbitrary
paths and staging archives are denied. Future authorized-key enrollment must use
OpenSSH restrictions, including disabled forwarding/PTY/user-rc, and the fixed
root-owned helper command. No key enrollment is performed by this source change.

The verified live route is `https://fleetflow.ashbi.ca`, currently owned by the
existing Traefik file `/opt/traefik/dynamic/fleetflow.yml` and legacy upstream
`127.0.0.1:3096`. Production preparation must preserve this hostname and explicitly
hand routing ownership to the new Coolify resource after private acceptance.
Do not create competing routers or infer `fleet.ashbi.ca` is already live from
the legacy repository notes. The production environment is presently empty.

Capture verifies dedicated runtime/volume, current image/source and role-init
parity, then holds a read-only exported snapshot for table content fingerprints
and `pg_dump`. Configuration and all running app/migration/role/PostgreSQL images
are encrypted together. The archive is privately decrypted, manifest checked and
restored into an internal network with fresh credentials and temporary storage.
All table fingerprints must match; the exact archived runtime must pass database
readiness, revision, anonymous denial and restricted-role checks without changing
recovered contents. Temporary resources/plaintext are cleaned. This verifies
database/image recovery, not original password sessions, external-host recovery
or independent key custody. Restore capacity is currently bounded by a 512MiB
temporary database filesystem; larger data requires a separately reviewed limit.

The client uses pinned host keys, asks the restricted helper for a fresh
nonce/workflow-bound proof, copies only the encrypted archive and streams its
checksum/length. It writes the validated copy/proof into the runner-private
backup directory. The disabled release workflow uploads the encrypted backup,
rechecks main after recovery, then consumes paired checked image receipts. Backup
failure, tampered bytes or stale proofs fail before release pins change.

Operator-only rehearsal explicitly selects the existing staging resource and
marks the result as staging. Such a proof cannot pass the production consumer or
be downloaded through the production forced-command protocol. Staging's older
source-built migration image can differ in ID while sharing the same verified
revision; production requires the migration/app image ID to match.
