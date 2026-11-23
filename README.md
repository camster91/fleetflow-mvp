<p align="center">
  <img src="public/brand/logo/logo-horizontal.svg" alt="Fleetvera" width="320">
</p>

# Fleetvera

Multi-tenant fleet operations SaaS for small delivery and service fleets: vehicles, deliveries, maintenance, drivers and team roles in one workspace.

(The repository keeps its original name, `fleetflow-mvp`; the product is branded Fleetvera.)

## What it does

Fleetvera gives a fleet owner, their dispatchers, technicians and drivers a shared workspace with a view built for each role. Dispatchers assign and track deliveries, technicians work a maintenance queue, drivers see only their own stops, and owners see the risks that need attention first. Accounts are invitation-only. `FLEETVERA_RELEASE_MODE` selects `pilot` (free beta, no plan enforcement) or `public` (trials and plan enforcement).

## Current status

The application code is built, and it is part-way through a move from PostgreSQL in Docker to Cloudflare Workers (OpenNext) with a D1 database and R2 storage:

- `prisma/schema.prisma` now targets SQLite. `lib/prisma.ts` uses the D1 binding on Workers and a local SQLite file everywhere else.
- The PostgreSQL migrations in `prisma/migrations` are kept as history and do not apply to the SQLite schema. The D1 schema is [d1/migrations/0001_init.sql](d1/migrations/0001_init.sql).
- The root `Dockerfile`, `docker-compose.yml`, `entrypoint.sh`, the `CI` and nightly workflows, and several runbooks still assume PostgreSQL and have not been ported.
- Some code paths still call the PostgreSQL function `pg_advisory_xact_lock`, which SQLite and D1 do not provide. These include team creation and invitations, profile and notification settings, document upload, Stripe checkout and webhooks, and workspace retention.

This README does not claim a live deployment. The gates in [docs/release-readiness.md](docs/release-readiness.md) were written before this move.

## Key features

- **Fleet records**: vehicles, clients, deliveries and maintenance work orders, all scoped to a personal or team workspace.
- **Role command centres**: separate dashboards for owner/manager, dispatcher, technician and driver, with permission checks in the API routes. The driver view is single-column with 44px touch targets and fits a 375px screen. See [docs/role-command-centres.md](docs/role-command-centres.md).
- **Delivery workflow**: status transitions with an event timeline, stable driver assignment, and a dedicated driver delivery page.
- **Maintenance attention scoring**: a deterministic, explainable rubric that ranks vehicles by overdue work, mileage since service, repeat issues, cost trend and age. It is a prioritization aid, not a failure prediction. See [docs/maintenance-risk-scoring.md](docs/maintenance-risk-scoring.md).
- **Fleet intelligence brief**: rule-based findings and data-quality checks with direct links to the records that need fixing.
- **AI assistant (optional)**: answers fleet questions with cited sources and proposes actions as previews the user must confirm. Uses OpenAI when configured, with prompt redaction, telemetry and an offline evaluation suite (`npm run ai:evaluate`).
- **Document intelligence**: upload fleet documents and extract fields for review. Production uploads stay blocked until a malware scanner adapter is registered (none is in this repository).
- **Integrations**: Google Maps and QuickBooks Online via OAuth, with staged records that are reviewed before import.
- **Teams and access**: team workspaces, email invitations, workspace switcher, and roles for dispatchers, drivers, technicians and viewers.
- **Security**: passwordless email login codes, optional TOTP two-factor auth, HTTP-only signed JWT sessions, login lockout, rate limiting, encrypted provider secrets, and audit logs.
- **Billing**: Stripe Checkout, customer portal, invoices and signed webhooks, with trial and read-only states for lapsed workspaces.
- **Reporting and API**: analytics dashboards, fleet/delivery/maintenance reports with CSV export, and a versioned public API (`/api/v1`) with scoped API keys.
- **Operations**: platform admin pages for user invitations, launch readiness checks, email delivery and AI health; scheduled retention and reminder jobs; Sentry error monitoring.

## Tech stack

- Next.js 16 (Pages Router), React 19, TypeScript
- Tailwind CSS 4, Recharts, lucide-react
- Prisma 7 with SQLite: Cloudflare D1 on Workers, better-sqlite3 locally
- Cloudflare Workers through OpenNext (`wrangler.jsonc`, `open-next.config.ts`), with R2 for documents
- Custom HS256 JWT sessions (`jose`), bcryptjs, speakeasy (TOTP), zod validation
- Stripe, Mailgun, OpenAI (optional), Sentry
- Jest and Testing Library for unit/integration tests, Playwright (with axe-core) for end-to-end tests

## Getting started

Requirements: Node.js 22.12.0 or newer and npm. Local development uses a SQLite file, so no database server is needed.

```bash
npm ci
cp .env.example .env.local   # Windows: copy .env.example .env.local
npx prisma generate
npx prisma db push           # creates ./dev.db; local throwaway file only
npm run dev
```

In `.env.local`, leave `DATABASE_URL` empty (the default is `file:./dev.db`) and set a random `JWT_SECRET` of at least 32 characters. Next.js reads `.env.local`; the seed and admin scripts read the shell environment, so export `DATABASE_URL` there too if you change it. The app runs at `http://localhost:3000`.

On an empty database, create the first administrator either from the sign-in form or with the command below. Both refuse once any user exists, so do this instead of seeding.

```bash
ADMIN_EMAIL=owner@example.com CONFIRM_ADMIN_BOOTSTRAP=yes npm run admin:bootstrap
```

Other sign-ins use a one-time code sent by email, which needs Mailgun settings. After setup, accounts are invitation-only: an admin invites customers from `/admin/users`, and customers create their team at `/team` and invite teammates.

| Command | Purpose |
| --- | --- |
| `npm run db:seed` | Seed sample data into the local SQLite file |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks |
| `npm run format` | Format with Prettier |

Never run `prisma db push` against a real database. Do not run `prisma migrate deploy` with the SQLite schema: the migrations in `prisma/migrations` are PostgreSQL.

### Environment variables

[.env.example](.env.example) lists them with notes. The main groups:

- Core: `DATABASE_URL`, `JWT_SECRET`, `NEXTAUTH_URL`, `FLEETVERA_RELEASE_MODE`, `TOKEN_ENCRYPTION_KEY`, `ACTION_PREVIEW_KEYS`, `ACTION_PREVIEW_CURRENT_KID`, `API_CURSOR_SECRET`, `CRON_SECRET`, `EMAIL_CONFIG_ENCRYPTION_KEY`
- Email: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `EMAIL_FROM`
- Billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- AI (off by default): `AI_PROVIDER`, `AI_KILL_SWITCH`, `OPENAI_API_KEY`, `OPENAI_MODEL`
- Documents and integrations: `DOCUMENT_*`, `INTEGRATION_ENCRYPTION_KEYS`, `GOOGLE_MAPS_SERVER_API_KEY`, `QUICKBOOKS_*`
- Monitoring: `NEXT_PUBLIC_SENTRY_DSN`

## Testing

```bash
npm run ci          # audit, lint, format check, typecheck, AI evaluation, Jest, production build
npm test            # Jest only
npm run test:e2e    # Playwright browser tests
npm run test:e2e:smoke
```

The test matrix is described in [docs/testing/e2e-matrix.md](docs/testing/e2e-matrix.md).

GitHub Actions workflows:

- `rebuild-checks.yml` runs on pull requests and `main`, and covers only `replacement/`.
- `ci.yml` defines the root app gate (`npm run ci`, migration drift, Playwright, container build) but is disabled in the repository settings as of 2026-11-23.
- `e2e-nightly.yml` is the cross-browser Playwright run. It still provisions PostgreSQL, and its run on 2026-11-23 failed with Prisma error P1013 (invalid database URL).

One Jest case in `__tests__/lib/releaseGates.test.ts` reads `.github/workflows/deploy-coolify.yml`, which has been removed.

## Deployment

The current target is Cloudflare Workers. `wrangler.jsonc` defines the `fleetvera` Worker with a D1 binding (`DB`) and an R2 binding (`MEDIA`).

| Command | Purpose |
| --- | --- |
| `npm run build:cf` | Build the Worker bundle |
| `npm run preview` | Build and preview the Worker locally |
| `npm run deploy` | Build and deploy; changes the live Worker |

Set secrets on the Worker, not in the repository. `rebuild-coolify-release.yml` is a separate, opt-in release path for `replacement/` and runs only when its repository variables are enabled.

## Project structure

```
pages/            Next.js pages and API routes (pages/api, pages/api/v1)
components/       UI kit, layouts, role dashboards, assistant and intelligence views
lib/              auth, permissions, tenancy, AI, integrations, intelligence, billing
services/         client-side API and email services
prisma/           SQLite schema, seed, and historical PostgreSQL migrations
d1/               Cloudflare D1 schema
__tests__/        Jest tests (API, components, lib, pages)
e2e/              Playwright specs
scripts/          admin, QA and verification scripts
replacement/      separate in-progress rebuild (Node + PostgreSQL), see its README
docs/             product, scoring, data-deletion and release documentation
```

## More documentation

- [Product control](docs/product-control.md)
- [Release readiness](docs/release-readiness.md)
- [Data deletion policy](docs/data-deletion-policy.md)
- [Brand guide](docs/brand/FLEETVERA_BRAND_GUIDE.md)

## License

MIT. See [LICENSE](LICENSE).
