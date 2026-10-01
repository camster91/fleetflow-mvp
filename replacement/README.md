# Fresh Fleetvera implementation

This replacement starts a new code and migration history for the requested
discard/rebuild. It does not import old FleetFlow modules or run legacy migrations.
The existing repository/history and database remain recovery references.

Implemented: one-time owner/workspace bootstrap, salted password authentication,
hashed opaque sessions, canonical-origin checks, workspace membership, scoped
vehicles and private client records, delivery creation/assignment/status, role enforcement and transactional audit.
Owners and dispatchers can create vehicles/clients. Workspace members can read
vehicles; client contact records are limited to owners/dispatchers. Unauthorized
and foreign-workspace lookups fail without exposing whether records exist.

Owners and dispatchers create deliveries for workspace clients and assign an
available workspace vehicle plus a driver member. Drivers can read only their
assigned deliveries and progress assigned -> in transit -> delivered. Owners
and dispatchers can also cancel nonterminal deliveries; completed/cancelled
records are immutable. Assignments and status changes require the current
expectedVersion to reject stale updates. Delivery client/vehicle/driver foreign
keys are workspace scoped, and audit failures roll back the mutation.

The initial dispatch model allows one open assigned/in-transit delivery per
vehicle and driver. Planned deliveries can queue without assignment; completing
or cancelling a delivery frees its resources. Multi-stop routes and future
time-window reservations are not yet implemented. Tests exercise competing
assignments, role/isolation boundaries and a real PostgreSQL audit failure.

Both startup and migration require a dedicated `fleetvera_rebuild_` database;
the legacy `fleetflow` database is rejected. Setup requires a runtime token of at
least 32 characters and closes after the first user. Session cookies remain
HttpOnly, Secure, SameSite Strict and expire after 12 hours. Local QA may disable
Secure cookies only with `LOCAL_QA=true`; staging/production must leave it unset.

Maintenance records support planned -> in progress -> completed, or cancellation
of nonterminal records. Owners/dispatchers/mechanics track services, due dates,
notes and completed costs in integer minor units with an explicit currency.
An active service blocks dispatch; completion/cancellation releases the vehicle.
Active deliveries block service start. Both changes and audits commit together.
Owner/dispatcher operational reports show scoped status counts, overdue planned
services and completed costs grouped by currency, using a consistent snapshot.
Reports accept asOf calendar dates; their default is the current UTC date.

Owners can create/rename workspaces, issue or revoke seven-day single-use
invitations, and manage team roles/access with optimistic membership versions.
Invitation tokens are returned once for manual sharing, stored only as hashes,
and never emailed automatically. Reissuing invalidates older outstanding links.
New accounts set a password; existing accounts must prove their current password.
Invitations stop working if their issuer loses owner access. Workspace locks
serialize acceptance and role changes; the last active owner cannot be removed.
Drivers with active deliveries cannot be demoted/revoked until that work ends.
Revocation preserves historical delivery references while subsequent authorization
checks deny workspace access; access to other memberships remains intact.

The browser application provides owner setup, sign-in, invitation acceptance,
workspace selection, vehicle/client creation, delivery planning/assignment/status,
maintenance tracking, reports and owner team administration. Role-specific controls
match server permissions. Invitation links use a fragment and are removed from the
address bar after reading; session credentials are never stored in browser storage.
Untrusted values render as text. Service costs use normal currency amounts with
currency-specific decimal precision; large report totals preserve exact digits.
Checked browser CI exercises these flows using fresh PostgreSQL and fictional data.

The private staging Compose uses a dedicated persistent PostgreSQL volume and
separate migration-owner/runtime credentials. A post-migration role step grants
the runtime application scoped-schema data access without superuser, role/database
creation, public DDL or migration-table writes. Runtime audit rows allow insert/read,
not update/delete. No staging service publishes ports or configures a public route.

This is an incomplete rebuild. Persistent
Coolify candidate, restart/recovery QA, checked immutable releases and live
handoff remain required. Billing/AI/provider integrations are later scope.

Use Node22, `npm ci`, `npm run migrate`, and `npm test` against disposable QA
PostgreSQL. Integration tests require a `fleetvera_rebuild_qa_` database and never
skip when it is missing. Required runtime variables: DATABASE_URL,
REBUILD_DATABASE_NAME, APP_ORIGIN, SETUP_TOKEN and full40character RELEASE_SHA.
