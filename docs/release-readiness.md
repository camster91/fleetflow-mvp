# Release readiness

> This is the authoritative launch-gate checklist. Current product status,
> merge order, risks, access, and evidence provenance are maintained in
> [product-control.md](product-control.md). Dated test counts below prove only
> the candidate on which they were collected.

## Current evidence status — 2026-08-31

- Public health, landing, and pricing endpoints are reachable over HTTPS.
- Public health returned HTTP 200, `{"status":"ok"}`, and
  `Cache-Control: no-store`.
- These public checks do not identify the deployed commit or verify any
  authenticated workflow, provider, backup, monitoring, or rollback path.
- Current hardening work is reconciled in cumulative draft PR #121. Repository
  gates are verified for its recorded candidate head; it remains unmerged.
- `Ashbi Local CI` (VPS-hosted) is the owner-approved authoritative repository
  gate for this release. It passed the exact candidate head in an isolated
  Podman runner.
- GitHub Actions currently fails at the account billing boundary before checkout;
  that infrastructure-only failure is waived for this release and is not used as
  candidate evidence. No current merge candidate is approved.

## Proven locally (dated candidate evidence)

- Locked dependency install and zero-vulnerability dependency audit
- ESLint with zero warnings/errors, strict TypeScript, 38 Jest suites / 232 tests, and production Next.js build
- Production Docker image build and HTTP startup as the non-root runtime user
- PostgreSQL baseline deployment against a clean PostgreSQL 16 database
- Guarded first-admin bootstrap succeeds once in the production image and refuses a second run
- Tenant-scoped business APIs and workspace role tests
- Signed session, 2FA challenge, Stripe webhook, and single-use share-link tests
- One CI workflow and a manual, environment-protected deployment workflow
- Production-container browser QA at 375px and 1440px across the public site and 15 authenticated screens, with no page, console, or HTTP errors

These checks established their dated release candidate; they do not establish the current draft merge train or a new live release.

## Required external evidence

- [x] `Ashbi Local CI` passes on the exact candidate commit
- [ ] Repository rules require the exact-head `Ashbi Local CI` check before merge
- [x] Production deployment received explicit owner approval
- [x] Production PostgreSQL 16 connectivity, capacity, and encrypted backup are verified
- [x] An isolated restore drill completed in approximately 33 seconds
- [x] Existing database has all 17 candidate migrations applied; source and restore counts match
- [ ] Unique production `JWT_SECRET` and integration secrets are configured
- [ ] Production URL, DNS, and TLS are verified
- [ ] Stripe products, prices, webhook endpoint, signature secret, and test transaction are verified
- [ ] Email domain authentication and delivery are verified
- [ ] Sentry/monitoring and alert destination are verified; use unauthenticated `GET /api/health` as the no-store database-readiness target and record the monitor owner
- [ ] Privacy policy, terms, support contact, retention, deletion, and export policies are approved
- [x] Desktop and mobile critical-path browser QA passes against the local release candidate
- [ ] Desktop and mobile smoke QA passes against the deployed production URL
- [ ] Rollback owner and observation window are assigned
- [x] Explicit approval is recorded before deployment

## SaaS behavior

Users operate in a personal or accepted team workspace. API authorization scopes business records to that workspace and applies owner/admin/manager/member/viewer permissions. A team workspace uses its owner as the Stripe customer of record; owners and team admins may manage billing, managers may view it, and other roles cannot access billing data. FleetFlow Pro is currently a flat workspace subscription at $49 USD monthly or $490 USD yearly; team invitations reserve one of ten workspace seats.

Public maintenance links expire after seven days, may be revoked in storage, and accept one atomic report submission. Authentication uses signed HTTP-only cookies; optional TOTP requires a short-lived challenge before a session is issued.

## Release decision

Ship only when all required external evidence is attached to the exact commit. Any unchecked item is a release blocker, not an assumed pass.
