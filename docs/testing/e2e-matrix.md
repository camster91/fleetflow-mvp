# Playwright feature × role matrix

The matrix runs in the `e2e` CI job (`.github/workflows/ci.yml`) on Chromium
against a locally built server (`npm run build && npm run start`) and a
disposable Postgres 16 database that is migrated and seeded with
`npm run db:seed`. It never touches production (see `e2e/support/base-url.ts`).

| Piece | Location |
| --- | --- |
| Synthetic workspace data (users, vehicles, deliveries, maintenance, clients) | `prisma/matrix-fixtures.ts`, written by `prisma/seed.ts` |
| Test-only sign-in and the expected permission table | `e2e/matrix/support.ts` |
| Specs: role matrix | `e2e/matrix/roles.spec.ts` |
| Specs: auth flows (email code, 2FA, logout, log out everywhere) | `e2e/matrix/auth.spec.ts` |
| Specs: free-beta billing state | `e2e/matrix/billing.spec.ts` |
| Specs: SOPs, vending, reports, intelligence, documents, notifications, settings, idempotency | `e2e/matrix/features.spec.ts` |
| Test-only outbound mail capture (server side / spec side) | `lib/emailCapture.ts` / `e2e/support/mail-capture.ts` |
| Nightly cross-browser run | `.github/workflows/e2e-nightly.yml` |

## Authentication in E2E

Login is a passwordless email code, so the suite does **not** go through the
login UI and there is **no** test backdoor route. `signIn()` reads the seeded
user's `tokenVersion` from the database and signs an ordinary session JWT with
`signToken()` from `lib/auth.ts` (same claims as `pages/api/auth/login.ts`,
including `tv`), then sets the `token` and `fleetflow_team` cookies. This only
works when the test process and the server share `JWT_SECRET` and the
database, which is the case for the local CI server.

`e2e/matrix/auth.spec.ts` exercises the real login instead. Login codes are
stored only as hashes, so the spec reads them from the email: the server that
`playwright.config.ts` starts gets `E2E_EMAIL_CAPTURE_DIR`, and `sendEmail()`
then writes each message as JSON to that directory instead of calling Mailgun
(`lib/emailCapture.ts`). Capture only activates when the application URL
(`NEXTAUTH_URL`) is a plain-http loopback origin (`localhost`, `127.0.0.1`,
`[::1]`), which a deployment can never use because production requires a
canonical HTTPS URL; `npm run verify:production-config` also fails whenever
`E2E_EMAIL_CAPTURE_DIR` is set. When reusing an already running local server,
start it with the same variable (default: `$TMPDIR/fleetvera-e2e-mail`).

Each auth test creates its own synthetic user (`createSyntheticUser`) and sends
a fresh `X-Forwarded-For` address (`useFreshClientAddress`; the server trusts
one proxy hop), so the per-IP and per-email login rate limits and lockouts
never carry over between tests, retries or reruns. TOTP codes come from the
secret returned by `POST /api/auth/2fa/setup` (speakeasy, same library as the
server); the login step uses the next 30s step, because the setup code's step
is recorded and can never be replayed.

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

### Features (`e2e/matrix/features.spec.ts`)

One test per role (`<ROLE>: SOPs, vending, reports, intelligence and settings follow the role`)
asserts every row below through the API and, where noted, the page. Its
expected table is `FEATURES` in the spec, again written independently of
`lib/permissions.ts`.

| Feature | OWNER | ADMIN | MANAGER | DISPATCHER | TECHNICIAN | DRIVER | VIEWER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SOPs list: `GET /api/sop` + `/sop` shows the category | ✅ | ✅ | ✅ | ⛔ | ✅ | ✅ | ✅ |
| SOPs create + edit control on `/sop` | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| Vending machines list: API + `/vending-machines` | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ✅ |
| Vending machines update: `PUT /api/vending-machines/:id` | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| Reports: `GET /api/reports/{fleet,deliveries,maintenance}`; `/reports` loads for every role | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| Intelligence brief: `GET /api/intelligence/brief` + `/intelligence` page | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ✅ |
| Workspace time zone: read (all), `PATCH /api/settings/workspace` | ✅ | ✅ | read | read | read | read | read |
| Checkout: `POST /api/stripe/checkout-session` (free beta: 503 unavailable) | 503 | 503 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |

Owner workflows in the same file:

| Workflow (test title) | Asserted |
| --- | --- |
| `SOP category: create, rename, list, delete` | 201, 400 on empty name, rename, listed on `/sop`, delete then 404 |
| `vending machine: create, update, list, delete` | 400 without location, 201, status update, listed with edit control, delete |
| `workspace time zone: owner changes it in settings; an invalid zone is rejected` | `/settings/company` select + save persists `Team.timeZone`; `Mars/Olympus_Mons` → 400 and no change; restored afterwards |
| `deliveries: the same Idempotency-Key twice creates one delivery` | both 201, second has `Idempotent-Replayed: true` and the same id, one row in the DB; same key with a different body → 422 |
| `notifications: a new notification is listed and can be marked read` | listed on `/notifications`, "Mark as read" persists, another member's API never returns it |
| `documents: an empty workspace shows the empty state and uploads fail closed without storage` | "No documents yet."; upload → 503 "Document scanning is unavailable" (no scanner in the CI server) and no row is stored |

### Auth flows (`e2e/matrix/auth.spec.ts`)

| Flow (test title) | Asserted |
| --- | --- |
| `email code: request, sign in, and sign out` | `/auth/login` → code from the captured email → `/dashboard`, `/api/auth/me` 200; "Sign out" in the account menu → `/auth/login`, `me` 401, `/dashboard` redirects to login |
| `wrong code: rejected without a session, then the real code still works` | wrong code shows "Invalid or expired code" and no session; the real code then signs in |
| `2fa: enroll, login requires a TOTP, and a backup code works exactly once` | enroll on `/settings/security` (setup → verify with a generated TOTP), backup codes emailed; a new login stops at the 2FA step until a TOTP is entered; a backup code signs in once (9 left) and replaying it with the same challenge → 400 `INVALID_CODE` |
| `log out everywhere: ends the session in every other browser` | confirm dialog on `/settings/security` bumps `tokenVersion`; the other browser's cookie is then rejected by `/api/auth/me`, `/api/dashboard/context` and `/api/vehicles` |

### Billing, free beta (`e2e/matrix/billing.spec.ts`, plus `billing: …` rows above)

| Test | Asserted |
| --- | --- |
| `pricing advertises the free beta without a checkout path` | "Free during the beta", no subscribe/checkout buttons or Stripe links |
| `billing availability reports unavailable with no pricing` | `GET /api/stripe/availability` → `{ available: false, pricing: null, … }` |
| `owner billing page shows the free-beta plan and no checkout or cancel controls` | owner `/billing`: free-beta notice, no "managed by your owner" note, no subscribe/cancel |
| `unauthenticated billing and checkout requests are refused` | 401 for status and checkout |

Non-billing roles get the read-only notice (`billing: …` in `roles.spec.ts`).

The expected table lives in `EXPECTATIONS` (`e2e/matrix/support.ts`) and is
written independently of `lib/permissions.ts`, so a permission change has to be
made deliberately in both places.

## Browsers and schedule

- Every PR (`e2e` job in `ci.yml`): `npm run test:e2e:ci`, Chromium only,
  about 2.5 minutes of test time.
- Nightly and on demand (`.github/workflows/e2e-nightly.yml`): the same specs
  on `chromium`, `firefox`, `webkit` and `mobile-375` (Chromium at a 375×812
  touch viewport), one job per project. `mobile-375` only exists when
  `E2E_ALL_BROWSERS=1`, so a bare `npx playwright test` stays desktop-only.
  Locally: `npm run test:e2e:nightly` (needs all three browsers installed).

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

Still open from #153:

- Stripe-configured plan states (checkout → active → past_due → canceled →
  read-only, Per-User seat quantity). Paid plans are deferred for the free
  beta; simulating them needs Stripe test mode or a mocked Stripe API, and
  setting `STRIPE_*` env on the test server alone would make checkout call
  the real Stripe API, so these are not simulated.
- Auth: sign-up/registration, invitation acceptance (the mail capture now makes
  the invite link readable) and workspace switching.
- Routes, drivers/assignments, maintenance share links, delivery
  timeline/events, assistant + actions, analytics and exports, admin pages,
  GDPR export/delete, and the v1 API.
- Running the suite against the VPS/staging deployment: the matrix signs
  sessions with the server's `JWT_SECRET` and reads the database directly, so
  a remote run needs a staging-specific sign-in strategy first.
- A revoked session (after "Log out everywhere") is rejected by every API, but
  the edge proxy only checks the JWT signature, so navigating to a page still
  renders the app shell until the client sees the 401. Asserted at the API
  level only.
- Firefox and WebKit have not been run yet: they first run in the nightly workflow
  (Chromium and `mobile-375` pass locally). The server sets `Secure` session
  cookies in production mode; if WebKit rejects them on `http://localhost`,
  the nightly WebKit job will show it.
