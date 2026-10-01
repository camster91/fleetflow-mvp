# Fleetvera

Fleetvera is a multi-tenant fleet operations SaaS built with the Next.js Pages Router, React, TypeScript, Prisma, and PostgreSQL. It includes vehicles, deliveries, maintenance, clients, team workspaces, reporting, subscription billing, and role-based access control.

## Local setup

Requirements: Node.js 22.12.0 or newer, npm, and PostgreSQL 16 (or Docker).

```bash
npm ci
cp .env.example .env.local   # Windows: copy .env.example .env.local
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Set a unique database password and a cryptographically random `JWT_SECRET` of at least 32 characters before starting. The app is available at `http://localhost:3000` by default.

For a brand-new database, bootstrap the first administrator once. This intentionally refuses to run after any user exists:

```bash
ADMIN_EMAIL=owner@example.com CONFIRM_ADMIN_BOOTSTRAP=yes npm run admin:bootstrap
```

The administrator signs in with the one-time code sent to that email. Accounts are invitation-only after that; see "Onboarding customers" below.

For the production Docker container, run the same guarded operation against the running application image:

```bash
docker exec -e ADMIN_EMAIL=owner@example.com -e CONFIRM_ADMIN_BOOTSTRAP=yes <container> node create-admin.js
```

Do not use `prisma db push` for production. Production startup runs the committed PostgreSQL migrations before starting the server.

## Onboarding customers

Sign-up is invitation-only during the beta:

1. A platform administrator invites a customer from **Admin → Users** (`/admin/users`, "Invite a customer"). This creates the account and emails sign-in instructions.
2. The customer signs in with an emailed one-time code, runs through (or skips) the setup wizard, and starts in their personal workspace.
3. On **Team** (`/team`) they create their team workspace (one per person during the beta); anything they already added moves into it. They then invite dispatchers, drivers, mechanics and other roles, who accept from the email link.

Platform administration pages (role `admin` only):

| Page | Purpose |
| --- | --- |
| `/admin/users` | Invite customers, change platform roles, remove accounts |
| `/admin/launch` | Launch readiness: live go-live checks (leaked secrets, configuration, email, monitoring, backups, billing), backup/monitoring evidence, go/no-go decision, test alert and Redeploy |
| `/admin/settings` | Stripe, Google Maps, QuickBooks, AI provider, cron secret, alert email and Coolify redeploy hook, encrypted, overriding the environment |
| `/admin/email-delivery` | Mailgun credentials for login codes and invitations |
| `/admin/pilot` | Controlled pilot enrollment and metrics |
| `/admin/ai-health` | AI provider status and controls |

The support address shown to users defaults to `support@ashbi.ca`; set `NEXT_PUBLIC_SUPPORT_EMAIL` to change it.

## Mandatory checks

```bash
npm run ci
```

That command runs the dependency audit, lint, strict typecheck, deterministic Jest suite, and production build. Browser tests are separate:

```bash
npm run test:e2e
```

The production-container visual harness is `scripts/visual-qa-release.cjs`. It accepts `VISUAL_QA_BASE_URL`, `VISUAL_QA_USER_ID`, `VISUAL_QA_USER_EMAIL`, and `VISUAL_QA_JWT_SECRET`; use only isolated QA credentials and infrastructure.

## Architecture

- Next.js 16 Pages Router (`pages/` and `pages/api/`)
- React 19 and Tailwind CSS
- Custom HS256 JWT sessions in a signed HTTP-only `token` cookie, with optional TOTP 2FA
- Prisma 5 with PostgreSQL
- Tenant selection through an HTTP-only workspace cookie
- Stripe subscriptions and signed webhooks
- Jest and Playwright
- Docker/Coolify deployment

Business records are scoped to a personal workspace or an accepted team workspace. Team roles are enforced in API routes; a workspace switcher selects the active tenant.

## Deployment

The Docker entrypoint runs `prisma migrate deploy` and then starts the standalone Next.js server. GitHub Actions CI builds but does not publish or deploy. Production deployment is a manual, environment-protected workflow that requires the exact approved `main` commit SHA. `main` is the production branch; Coolify builds the root `Dockerfile` from it (the separate rebuild in `replacement/` has its own disabled release pipeline).

See [product control](docs/product-control.md), [release readiness](docs/release-readiness.md), [deploy and rollback](docs/runbooks/deploy-and-rollback.md), and [backup and restore](docs/runbooks/backup-restore.md). No production deployment, DNS change, or live account change is implied by a passing local build.

## Database baseline

The repository contains a PostgreSQL baseline migration for a new database. If a database already contains Fleetvera tables from an older `db push` or SQLite-era process, do not run deployment migrations blindly. Back it up, compare it with the current Prisma schema, and follow the existing-database procedure in the deployment runbook.

## License

Private and proprietary.
