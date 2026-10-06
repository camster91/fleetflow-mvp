<p align="center">
  <img src="public/brand/logo/logo-horizontal.svg" alt="Fleetvera" width="320">
</p>

# Fleetvera

Multi-tenant fleet operations SaaS for small delivery and service fleets: vehicles, deliveries, maintenance, drivers and team roles in one workspace.

(The repository keeps its original name, `fleetflow-mvp`; the product is branded Fleetvera.)

## What it does

Fleetvera gives a fleet owner, their dispatchers, technicians and drivers a shared workspace with a view built for each role. Dispatchers assign and track deliveries, technicians work a maintenance queue, drivers see only their own stops, and owners see the risks that need attention first. It runs as an invitation-only beta, with Stripe subscriptions ready for a public release mode.

## Key features

- **Fleet records**: vehicles, clients, deliveries and maintenance work orders, all scoped to a personal or team workspace.
- **Role command centres**: separate dashboards for owner/manager, dispatcher, technician and driver, with permissions enforced in every API route. The driver view is single-column with 44px touch targets and fits a 375px screen. See [docs/role-command-centres.md](docs/role-command-centres.md).
- **Delivery workflow**: status transitions with an event timeline, stable driver assignment, and a dedicated driver delivery page.
- **Maintenance attention scoring**: a deterministic, explainable rubric that ranks vehicles by overdue work, mileage since service, repeat issues, cost trend and age. It is a prioritization aid, not a failure prediction. See [docs/maintenance-risk-scoring.md](docs/maintenance-risk-scoring.md).
- **Fleet intelligence brief**: rule-based findings and data-quality checks with direct links to the records that need fixing.
- **AI assistant (optional)**: answers fleet questions with cited sources and proposes actions as previews the user must confirm. Uses OpenAI when configured, with prompt redaction, telemetry and an offline evaluation suite (`npm run ai:evaluate`).
- **Document intelligence**: upload fleet documents and extract fields for review before anything is saved.
- **Integrations**: Google Maps and QuickBooks Online via OAuth, with staged records that are reviewed before import.
- **Teams and access**: team workspaces, email invitations, workspace switcher, and roles for dispatchers, drivers, technicians and viewers.
- **Security**: passwordless email login codes, optional TOTP two-factor auth, HTTP-only signed JWT sessions, login lockout, rate limiting, encrypted provider secrets, and audit logs.
- **Billing**: Stripe Checkout, customer portal, invoices and signed webhooks, with trial and read-only states for lapsed workspaces.
- **Reporting and API**: analytics dashboards, fleet/delivery/maintenance reports with CSV export, and a versioned public API (`/api/v1`) with scoped API keys.
- **Operations**: platform admin pages for user invitations, launch readiness checks, email delivery and AI health; scheduled retention and reminder jobs; Sentry error monitoring.

## Tech stack

- Next.js 16 (Pages Router), React 19, TypeScript
- Tailwind CSS, Recharts, lucide-react
- Prisma 5 with PostgreSQL 16
- Custom HS256 JWT sessions (`jose`), bcryptjs, speakeasy (TOTP), zod validation
- Stripe, Mailgun, OpenAI (optional), Sentry
- Jest and Testing Library for unit/integration tests, Playwright (with axe-core) for end-to-end tests
- Docker (standalone Next.js server that runs Prisma migrations on startup)

## Getting started

Requirements: Node.js 22.12.0 or newer, npm, and PostgreSQL 16 (or Docker).

```bash
npm ci
cp .env.example .env.local   # Windows: copy .env.example .env.local
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Before starting, set a unique database password and a cryptographically random `JWT_SECRET` of at least 32 characters in `.env.local`. The app runs at `http://localhost:3000`.

On a brand-new database, create the first administrator once (the command refuses to run after any user exists):

```bash
ADMIN_EMAIL=owner@example.com CONFIRM_ADMIN_BOOTSTRAP=yes npm run admin:bootstrap
```

The administrator signs in with a one-time code sent to that email. After that, accounts are invitation-only: an admin invites customers from `/admin/users`, and customers create their team at `/team` and invite teammates.

Other useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` / `npm run typecheck` | ESLint and strict TypeScript checks |
| `npm run format` | Format with Prettier |

Do not use `prisma db push` against a real database; the committed migrations in `prisma/migrations` are the source of truth.

## Testing

```bash
npm run ci          # audit, lint, format check, typecheck, AI evaluation, Jest, production build
npm test            # Jest only
npm run test:e2e    # Playwright browser tests
npm run test:e2e:smoke
```

GitHub Actions runs `npm run ci`, a Prisma migration drift check, a Chromium Playwright smoke and role matrix, and a production container build for code changes on pull requests and `main`, plus a nightly cross-browser Playwright run (Chromium, Firefox, WebKit and a 375px mobile viewport). The test matrix is described in [docs/testing/e2e-matrix.md](docs/testing/e2e-matrix.md).

## Project structure

```
pages/            Next.js pages and API routes (pages/api, pages/api/v1)
components/       UI kit, layouts, role dashboards, assistant and intelligence views
lib/              auth, permissions, tenancy, AI, integrations, intelligence, billing
services/         client-side API and email services
prisma/           schema, migrations and seed
__tests__/        Jest tests (API, components, lib, pages)
e2e/              Playwright specs
scripts/          admin, QA and verification scripts
replacement/      in-progress lightweight rebuild (Node + PostgreSQL), see its README
docs/             product, scoring, data-deletion and release documentation
```

## More documentation

- [Product control](docs/product-control.md)
- [Release readiness](docs/release-readiness.md)
- [Data deletion policy](docs/data-deletion-policy.md)
- [Brand guide](docs/brand/FLEETVERA_BRAND_GUIDE.md)

## License

MIT. See [LICENSE](LICENSE).
