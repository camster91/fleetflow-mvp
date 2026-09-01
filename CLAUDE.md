# CLAUDE.md — FleetFlow MVP

## What This Is
A fleet management SaaS app. Live at fleet.ashbi.ca. Next.js with pages router (not app router).

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
- Branch: master (not main!)

## Release Keystore (Android)
- N/A — FleetFlow is a web-only application, no Android keystore needed

## DO NOT
- Do not change the database URL — it points to VPS Postgres
- Do not switch from pages router to app router without a full migration plan
- Branch is `master` not `main`
