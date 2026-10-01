# CLAUDE.md — Fleetvera (repo: fleetflow-mvp)

## What This Is
A fleet management SaaS app, branded **Fleetvera** in everything users see (the repo and some internal identifiers keep the old FleetFlow name). Intended host: fleet.ashbi.ca (Coolify on the Ashbi VPS). Next.js with pages router (not app router).

## How people get in
- Invitation-only beta. The first platform admin is created with `create-admin.js`; admins invite customers at `/admin/users`; customers create their team at `/team` and invite teammates.
- Provider secrets (Stripe, Maps, QuickBooks, AI, cron) can be set by platform admins at `/admin/settings` (see `lib/platformSettings.ts`); Mailgun at `/admin/email-delivery`. `/admin/launch` (`lib/launchReadiness.ts`) shows live go-live checks, records backup/monitoring evidence and the go/no-go decision (`OpsRecord`), sends a test alert and triggers a Coolify redeploy. Failed cron jobs and unhandled request errors email `OPS_ALERT_EMAIL` (`lib/opsAlerts.ts`, throttled, content-free).
- Plans: `FLEETVERA_RELEASE_MODE=pilot` is the free beta (no enforcement); `public` enables trials, read-only lapsed workspaces and retention (`lib/entitlements.ts`, `lib/workspaceRetention.ts`, `docs/runbooks/stripe-launch.md`).

## Stack
- Next.js (Pages Router)
- Prisma + PostgreSQL (migrated from SQLite on 2026-03-17)
- Custom JWT cookie authentication (`lib/auth.ts`)
- Tailwind

## Database
- Host: Set via DATABASE_URL env var (see .env.example for format)
- fleetflow-postgres container on VPS coolify network

## Auth
- The runtime uses the custom HS256 JWT implementation in `lib/auth.ts` and the HTTP-only `token` cookie.
- `getServerSession` and `authOptions` are compatibility exports for older call sites; they do not configure NextAuth.
- Env vars: `JWT_SECRET` (required signing key) and `NEXTAUTH_URL` (canonical application URL retained for compatibility).
- Login-code issuance and validation live under `pages/api/auth/`; do not introduce a parallel session system.

## Coolify
- UUID: p804488s4gs0k0kwc4080wg0
- URL: https://fleet.ashbi.ca
- Branch: `main` is the production branch (Coolify deploys it); `master` is a mirror kept until retired

## Release Keystore (Android)
- N/A — FleetFlow is a web-only application, no Android keystore needed

## DO NOT
- Do not change the database URL — it points to VPS Postgres
- Do not switch from pages router to app router without a full migration plan
- Open PRs against `main`
