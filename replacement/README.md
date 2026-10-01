# Fresh Fleetvera implementation

This replacement starts a new code and migration history for the requested
discard/rebuild. It does not import old FleetFlow modules or run legacy migrations.
The existing repository/history and database remain recovery references.

Implemented: one-time owner/workspace bootstrap, salted password authentication,
hashed opaque sessions, canonical-origin checks, workspace membership, scoped
vehicles and private client records, role enforcement and transactional audit.
Owners and dispatchers can create vehicles/clients. Workspace members can read
vehicles; client contact records are limited to owners/dispatchers. Unauthorized
and foreign-workspace lookups fail without exposing whether records exist.

Both startup and migration require a dedicated `fleetvera_rebuild_` database;
the legacy `fleetflow` database is rejected. Setup requires a runtime token of at
least 32 characters and closes after the first user. Session cookies remain
HttpOnly, Secure, SameSite Strict and expire after 12 hours. Local QA may disable
Secure cookies only with `LOCAL_QA=true`; staging/production must leave it unset.

This is an incomplete rebuild. Team invitations, workspace management, delivery
assignment/status workflows, maintenance, reporting, browser UI, persistent
Coolify candidate, restart/recovery QA, checked immutable releases and live
handoff remain required. Billing/AI/provider integrations are later scope.

Use Node22, `npm ci`, `npm run migrate`, and `npm test` against disposable QA
PostgreSQL. Integration tests require a `fleetvera_rebuild_qa_` database and never
skip when it is missing. Required runtime variables: DATABASE_URL,
REBUILD_DATABASE_NAME, APP_ORIGIN, SETUP_TOKEN and full40character RELEASE_SHA.
