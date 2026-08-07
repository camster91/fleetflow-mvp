# Release readiness

## Proven locally

- Locked dependency install and zero-vulnerability dependency audit
- ESLint with zero warnings/errors, strict TypeScript, 38 Jest suites / 232 tests, and production Next.js build
- Production Docker image build and HTTP startup as the non-root runtime user
- PostgreSQL baseline deployment against a clean PostgreSQL 16 database
- Guarded first-admin bootstrap succeeds once in the production image and refuses a second run
- Tenant-scoped business APIs and workspace role tests
- Signed session, 2FA challenge, Stripe webhook, and single-use share-link tests
- One CI workflow and a manual, environment-protected deployment workflow
- Production-container browser QA at 375px and 1440px across the public site and 15 authenticated screens, with no page, console, or HTTP errors

These checks establish a release candidate, not a live release.

## Required external evidence

- [ ] CI passes on the exact commit on GitHub
- [ ] Branch protection requires the CI quality and container jobs
- [ ] Production environment requires an authorized reviewer
- [ ] Production PostgreSQL version, connectivity, capacity, and encrypted backup are verified
- [ ] A restore drill is completed and timed
- [ ] Existing database migration path is selected and rehearsed
- [ ] Unique production `JWT_SECRET` and integration secrets are configured
- [ ] Production URL, DNS, and TLS are verified
- [ ] Stripe products, prices, webhook endpoint, signature secret, and test transaction are verified
- [ ] Email domain authentication and delivery are verified
- [ ] Sentry/monitoring, alert destination, logs, and health checks are verified
- [ ] Privacy policy, terms, support contact, retention, deletion, and export policies are approved
- [x] Desktop and mobile critical-path browser QA passes against the local release candidate
- [ ] Desktop and mobile smoke QA passes against the deployed production URL
- [ ] Rollback owner and observation window are assigned
- [ ] Explicit approval is recorded before deployment

## SaaS behavior

Users operate in a personal or accepted team workspace. API authorization scopes business records to that workspace and applies owner/admin/manager/member/viewer permissions. A team workspace uses its owner as the Stripe customer of record; owners and team admins may manage billing, managers may view it, and other roles cannot access billing data. FleetFlow Pro is currently a flat workspace subscription at $49 USD monthly or $490 USD yearly; team invitations reserve one of ten workspace seats.

Public maintenance links expire after seven days, may be revoked in storage, and accept one atomic report submission. Authentication uses signed HTTP-only cookies; optional TOTP requires a short-lived challenge before a session is issued.

## Release decision

Ship only when all required external evidence is attached to the exact commit. Any unchecked item is a release blocker, not an assumed pass.
