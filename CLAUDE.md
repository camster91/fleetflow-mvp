# CLAUDE.md — FleetFlow MVP

## What This Is
A fleet management SaaS app. Live at fleet.ashbi.ca. Next.js with pages router (not app router).

## Stack
- Next.js (Pages Router)
- Prisma + PostgreSQL (migrated from SQLite on 2026-03-17)
- NextAuth with custom credentials provider
- Tailwind

## Database
- Host: Set via DATABASE_URL env var (see .env.example for format)
- fleetflow-postgres container on VPS coolify network

## Auth
- NextAuth with JWT strategy
- Env vars: NEXTAUTH_URL, NEXTAUTH_SECRET (set in deployment environment)
- Custom auth also in pages/api/auth/login.ts (parallel system)

## Coolify
- UUID: p804488s4gs0k0kwc4080wg0
- URL: https://fleet.ashbi.ca
- Branch: master (not main!)

## Release Keystore (Android)
- File: android/app/jw-habits-release.keystore (wait — wrong app, FleetFlow is web only)

## DO NOT
- Do not change the database URL — it points to VPS Postgres
- Do not switch from pages router to app router without a full migration plan
- Branch is `master` not `main`
