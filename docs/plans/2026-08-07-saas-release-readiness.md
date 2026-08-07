# FleetFlow SaaS Release Readiness Implementation Plan

**Goal:** Make FleetFlow a secure, maintainable, multi-tenant SaaS that passes deterministic release gates and can be deployed with a tested rollback path.

**Architecture:** Preserve the Next.js Pages Router and PostgreSQL/Prisma foundation. Standardize on the existing custom signed-cookie authentication, centralize tenant authorization, and require tests, type checking, linting, dependency review, and builds before a single deployment workflow may run.

**Tech Stack:** Next.js 16 Pages Router, React 19, TypeScript, Prisma 5/PostgreSQL, Jest, Playwright, Docker, GitHub Actions, Coolify, Stripe, Mailgun/SendGrid, Sentry.

---

### Task 1: Establish truthful local quality gates

**Objective:** Make the repository expose type, test, and release failures consistently.

**Files:**
- Modify: `package.json`
- Modify: `jest.config.js`
- Modify: `next.config.js`
- Test: `__tests__/config/release-gates.test.ts`

**Steps:**
1. Write a failing configuration test asserting that builds do not ignore TypeScript errors and that `typecheck`, deterministic test, and CI scripts exist.
2. Run `npx jest __tests__/config/release-gates.test.ts --runInBand --no-cache` and confirm the expected assertions fail.
3. Add the scripts, exclude `.next` from Jest module discovery, and remove `typescript.ignoreBuildErrors`.
4. Re-run the focused test and confirm it passes.
5. Run `npm run lint`, `npm run typecheck`, and the deterministic test command; record remaining application failures for Task 2.

### Task 2: Repair TypeScript and test infrastructure

**Objective:** Reach a clean strict TypeScript check and a finite, reliable Jest suite.

**Files:**
- Modify: `types/next-auth.d.ts`
- Modify: `jest.setup.js`
- Modify: `tsconfig.json`
- Modify: affected files identified by `npm run typecheck`
- Test: existing suites under `__tests__/`

**Steps:**
1. Group current compiler failures by root cause: stale test fixtures, missing Jest DOM types, session shape, modal exports/props, hook signatures, Stripe SDK types, and chart/icon types.
2. For each root cause, add or adjust the smallest failing regression test first.
3. Apply the minimal production or fixture correction and confirm the focused test passes.
4. Run `npm run typecheck` after each group until it exits zero.
5. Run the complete Jest suite with open-handle detection and fix leaks until it finishes successfully without `.next` collisions.

### Task 3: Consolidate authentication

**Objective:** Expose one supported authentication system with consistent cookie, session, 2FA, and logout behavior.

**Files:**
- Modify or remove: `pages/api/auth/[...nextauth].ts`
- Modify: `lib/auth.ts`
- Modify: `middleware.ts`
- Modify: `context/AuthContext.tsx`
- Test: `__tests__/lib/auth.test.ts`
- Test: new API and middleware authentication tests

**Steps:**
1. Write failing tests for the selected custom JWT flow, password-change invalidation, 2FA completion, cookie clearing, and protected-route behavior.
2. Confirm the obsolete empty NextAuth configuration fails its contract or is unused.
3. Remove the unsupported endpoint and stale NextAuth client assumptions, or provide a complete configuration only if a verified consumer requires it.
4. Replace Edge-incompatible token verification in middleware with an Edge-compatible implementation.
5. Run auth, middleware, type, lint, and build checks.

### Task 4: Enforce tenant-aware data authorization

**Objective:** Let accepted team members access only data authorized for their team while preserving owner isolation.

**Files:**
- Modify: `lib/apiAuth.ts`
- Modify: `lib/permissions.ts`
- Modify: APIs under `pages/api/vehicles/`, `deliveries/`, `maintenance/`, `clients/`, `sop/`, `vending-machines/`, `announcements/`, `analytics/`, and `reports/`
- Test: new tenant authorization suites under `__tests__/pages/api/`

**Steps:**
1. Document the owner, admin, manager, member, and viewer permissions as executable test cases.
2. Write failing tests for same-team read/write, viewer write denial, cross-team denial, and owner access.
3. Add a centralized tenant context and scoped Prisma filters.
4. Migrate one resource family at a time, running its focused authorization tests after every change.
5. Run the full authorization and API suites and inspect all Prisma mutations for unscoped IDs.

### Task 5: Harden public links, uploads, secrets, billing, and webhooks

**Objective:** Close externally reachable abuse paths and prove payment/event idempotency.

**Files:**
- Modify: `pages/api/task/[token].ts`
- Modify: `pages/api/maintenance/[id]/share.ts`
- Modify: Stripe routes under `pages/api/stripe/`
- Modify: upload/email/integration routes as discovered
- Modify: `lib/cryptoSecrets.ts`, `lib/rateLimit.ts`, and `lib/validation.ts`
- Test: focused security and webhook suites

**Steps:**
1. Write failing tests for share-token entropy, expiry, one-time/revocation behavior, payload limits, webhook signatures, duplicate events, and ownership.
2. Apply bounded validation and constant-time secret comparisons where appropriate.
3. Align Stripe types and webhook state transitions with the installed SDK.
4. Confirm production secrets fail closed and never appear in logs or responses.
5. Run security tests and `npm audit --omit=dev`.

### Task 6: Resolve dependency and security-header findings

**Objective:** Remove actionable high-severity production vulnerabilities without breaking the Pages Router application.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `next.config.js`
- Test: security header/configuration tests

**Steps:**
1. Capture the production dependency audit and dependency paths.
2. Upgrade compatible packages in small groups and run typecheck/tests/build after each group.
3. Plan and execute any required Next.js major upgrade separately if no supported 15.x remediation exists.
4. Replace broad CSP `unsafe-eval`/`unsafe-inline` directives with nonce/hash-compatible policies where the runtime permits.
5. Require a zero-high production audit or document a narrowly justified, time-bounded exception.

### Task 7: Make CI deterministic and deployment singular

**Objective:** Ensure only a verified commit can trigger one observable Coolify deployment.

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/lint.yml`
- Modify or remove: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/deploy-coolify.yml`
- Modify: `.github/dependabot.yml`
- Test: local workflow syntax and repository scripts

**Steps:**
1. Add a failing workflow/config test that detects duplicate push deployments, `continue-on-error`, and missing mandatory gates.
2. Consolidate install, typecheck, lint, unit tests, production audit, and build into one required CI workflow using `npm ci`.
3. Make one deploy workflow depend on successful CI and use only the HTTPS secret-backed webhook.
4. Add concurrency, timeouts, minimal permissions, environment protection, deployment response validation, and rollback instructions.
5. Validate YAML locally and verify GitHub Actions on a pull request before production deployment.

### Task 8: Correct documentation and SaaS operational readiness

**Objective:** Make setup, architecture, billing, support, privacy, backup, and incident documentation match reality.

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Create: `docs/architecture.md`
- Create: `docs/runbooks/deploy-and-rollback.md`
- Create: `docs/runbooks/backup-restore.md`
- Create: `docs/runbooks/incident-response.md`
- Create: `docs/release-readiness.md`

**Steps:**
1. Replace App Router claims and stale endpoint/setup instructions with verified Pages Router behavior.
2. Document environment variable ownership without values or credentials.
3. Define tenant, subscription, trial, cancellation, deletion/export, support, and retention behavior.
4. Document backup restoration and rollback drills with evidence fields.
5. Produce a deployment-readiness checklist whose unknown external items remain explicitly unresolved.

### Task 9: Complete browser, accessibility, and performance QA

**Objective:** Prove critical SaaS journeys work across supported responsive sizes and browsers.

**Files:**
- Modify: Playwright tests under `e2e/`
- Modify: affected pages/components
- Store: review screenshots under `qa-screenshots/` only if repository policy permits

**Steps:**
1. Write failing browser tests for sign-in, onboarding, team invite, vehicle/delivery workflows, subscription checkout sandbox, settings, logout, and permission denial.
2. Fix one journey at a time and retain desktop/mobile screenshots at 375, 768, 1440, and 1920 widths.
3. Run automated accessibility scans and keyboard-only checks on each critical page.
4. Measure production-mode performance and reduce the shared vendor bundle and unoptimized images.
5. Repeat on Chrome, Firefox, Edge, and an iOS Safari device or approved equivalent.

### Task 10: Approval-gated launch verification

**Objective:** Establish production readiness without changing live state until explicit approval.

**Files:**
- Update: `docs/release-readiness.md`
- Update: `docs/runbooks/deploy-and-rollback.md`

**Steps:**
1. Verify DNS, TLS, production variables, PostgreSQL backup/restore, email authentication, Stripe production configuration, monitoring, alerting, logs, and Sentry.
2. Confirm a tested rollback artifact and database compatibility window.
3. Present the complete evidence report and unresolved external prerequisites.
4. Obtain explicit approval before pushing, opening/merging a PR, triggering Coolify, changing DNS, or using live Stripe/email credentials.
5. After approval, deploy once, run live smoke tests, monitor the first release window, and record the outcome.
