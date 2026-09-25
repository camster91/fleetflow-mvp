# Playwright feature × role matrix

The matrix runs in the `e2e` CI job (`.github/workflows/ci.yml`) on Chromium
against a locally built server (`npm run build && npm run start`) and a
disposable Postgres 16 database that is migrated and seeded with
`npm run db:seed`. It never touches production (see `e2e/support/base-url.ts`).

| Piece | Location |
| --- | --- |
| Synthetic workspace data (users, vehicles, deliveries, maintenance, clients) | `prisma/matrix-fixtures.ts`, written by `prisma/seed.ts` |
| Test-only sign-in and the expected permission table | `e2e/matrix/support.ts` |
| Specs | `e2e/matrix/roles.spec.ts` |

## Authentication in E2E

Login is a passwordless email code, so the suite does **not** go through the
login UI and there is **no** test backdoor route. `signIn()` reads the seeded
user's `tokenVersion` from the database and signs an ordinary session JWT with
`signToken()` from `lib/auth.ts` (same claims as `pages/api/auth/login.ts`,
including `tv`), then sets the `token` and `fleetflow_team` cookies. This only
works when the test process and the server share `JWT_SECRET` and the
database, which is the case for the local CI server.

## Seeded workspace

`Matrix Test Fleet (synthetic)` (`e2e-matrix-team`), one accepted member per
role, all with `@matrix.fleetvera.test` addresses and no passwords:
OWNER, ADMIN, MANAGER, DISPATCHER, TECHNICIAN, DRIVER, VIEWER.
Records: 2 vehicles (Alpha assigned to the driver), 3 deliveries (1 assigned to
the driver), 2 maintenance tasks (1 on the driver's vehicle), 2 clients.
Records created by the specs are deleted by the same test, so reruns are
deterministic.

## Matrix

✅ = allowed and asserted, ⛔ = forbidden (API returns 403) and asserted.
"Scoped" = the driver sees only work assigned to them.
All rows are in `e2e/matrix/roles.spec.ts`; the test title is shown per row.

| Feature (test title) | OWNER | ADMIN | MANAGER | DISPATCHER | TECHNICIAN | DRIVER | VIEWER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard command centre (`dashboard loads its role command centre`) | Owner | Owner | Owner | Dispatch | Maintenance | Driver | Fleet overview |
| Vehicles list: API + `/vehicles` (`vehicles: list …`) | ✅ | ✅ | ✅ | ✅ | ⛔ | ✅ scoped | ✅ |
| Vehicles create: `POST /api/vehicles` (`vehicles: create …`) | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| Deliveries list: API + `/deliveries` (`deliveries: list …`) | ✅ | ✅ | ✅ | ✅ | ⛔ | ✅ scoped | ✅ |
| Deliveries create: `POST /api/deliveries` (`deliveries: create …`) | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Maintenance list: API + `/maintenance` (`maintenance: list …`) | ✅ | ✅ | ✅ | ⛔ | ✅ | ✅ scoped | ✅ |
| Maintenance create: `POST /api/maintenance` (`maintenance: create …`) | ✅ | ✅ | ✅ | ⛔ | ✅ | ⛔ | ⛔ |
| Clients list: API + `/clients` (`clients: list …`) | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ✅ |
| Clients create: `POST /api/clients` (`clients: create …`) | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| List pages show Add/Edit/Delete only to roles that may create (`<resource>: list …`) | ✅ | ✅ | ✅ | deliveries | maintenance | ⛔ | ⛔ |
| Team page loads; invite (+ role change 403 for non-managers) (`team: …`) | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Team member list `GET /api/team` + list on `/team` (`team: …`) | ✅ | ✅ | ✅ | ⛔ notice | ⛔ notice | ⛔ notice | ✅ read-only |
| `/team` invite, change-role and remove controls (`team: …`) | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Dashboard sources match list permissions and list totals (`dashboard data follows list permissions and totals`) | all | all | all | no maintenance | maintenance only | scoped | all |
| API keys page loads; list/create/revoke (`api keys: …`) | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| Billing: subscription status (`billing: …`) | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| Billing: free-beta notice, never "could not be verified" (`billing: …`) | ✅ | ✅ | ✅ | ✅ read-only | ✅ read-only | ✅ read-only | ✅ read-only |
| Documents: a CONFIRMED document offers no second record (`documents: a CONFIRMED document …`) | ✅ | | | | | | |
| Driver sees only assigned deliveries/vehicles/maintenance, API + page + dashboard (`DRIVER assignment scope › …`) | | | | | | ✅ | |

The expected table lives in `EXPECTATIONS` (`e2e/matrix/support.ts`) and is
written independently of `lib/permissions.ts`, so a permission change has to be
made deliberately in both places.

## Running locally

```bash
# Throwaway Postgres 16, then:
export DATABASE_URL=postgresql://…/fleetflow JWT_SECRET=<any 32+ char test secret> NEXTAUTH_URL=http://localhost:3000
npx prisma migrate deploy && npm run db:seed && npm run build
npm run test:e2e:matrix      # or test:e2e:ci for smoke + matrix
```

## Known gaps (not yet asserted)

The role gaps found while building the matrix (#173: team list, `/team`
controls, list-page actions, dashboard scoping, billing notice, confirmed
documents) are fixed and asserted above.

- Not yet covered from #153: plan/billing state transitions, auth flows
  (email code, 2FA, invite acceptance), SOPs, vending machines, routes,
  intelligence, assistant, reports, admin, GDPR, and the nightly
  cross-browser/staging run.
