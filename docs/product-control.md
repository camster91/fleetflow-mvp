# Fleetvera product control

**Status date:** 2026-08-28 (America/Toronto)  
**Repository:** `camster91/fleetflow-mvp`  
**Current default-branch commit inspected:** `6938964a1fc64eab8d3f3e89ca8333c73f26476d`  
**Status:** release hardening in progress; public launch not approved

This is the authoritative product-control index. Use
[release-readiness.md](release-readiness.md) for launch gates and the runbooks under
[runbooks](runbooks) for operations. Dated plans and audit reports are evidence
snapshots, not current instructions.

## Product charter

Fleetvera is an invitation-only web workspace for small fleet operators who need
vehicles, deliveries, maintenance, clients, reports, and team access in one
place. The current public promise is “Fleet operations, organized.” The initial
wedge inferred from repository evidence is a small delivery or service fleet
whose owner or dispatcher is replacing spreadsheets and disconnected tools.

That target and positioning are **researched only from product artifacts**.
They are not customer-validated. Public expansion, material pricing changes, and
claims about saved time or cost require owner approval and real-customer
evidence.

## Evidence ledger

### Verified current on 2026-08-28

- GitHub default branch is `master` at `6938964a`.
- Public `GET https://fleetflow.ashbi.ca/api/health` returned HTTP 200,
  `{"status":"ok"}`, and `Cache-Control: no-store`.
- The public landing and pricing pages returned HTTP 200 and Fleetvera branding.
- The pricing page advertises Fleetvera Pro at $49 USD monthly or $490 USD
  yearly, with invitation-only workspace creation.
- Draft PRs #78 through #108 contain unmerged security, concurrency,
  configuration, operations, billing, product-control, and reliability changes. PR #88 is closed and
  superseded.
- Recent GitHub Actions runs, including runs 33197494128 through 33198494536,
  complete the quality job as failed before repository steps are exposed; the
  production-container job is skipped. The account billing/spending gate must
  be resolved before these drafts can be verified.

### Prior evidence, not proof of the current candidate

- [Task 16](release/task16-readiness-report.md) records an August 13 local gate,
  a deployed `1aaa945` image, public checks, and an ephemeral restore drill.
  Treat it as a dated snapshot. It does not prove the current production image
  or any August 28 draft.
- The public health response proves availability and a database probe only. It
  does not prove authenticated workflows, tenant isolation, provider delivery,
  durable backups, monitoring, or rollback readiness.

### Unknown or unavailable

- Exact current production image, environment configuration, and relation to
  `master`.
- Green CI, typecheck, test, build, container, migration, and browser evidence
  for the proposed merge candidate.
- Current production backup retention and a timed isolated restore using the
  retained backup.
- Authenticated desktop/mobile smoke results against the deployed candidate.
- Stripe webhook/Portal/price/restricted-key evidence, Stripe Tax registration
  status, Mailgun, OAuth, document scanner/extractor, monitoring, and alert
  delivery evidence.
- Active fleets, weekly active operators, activation, retention, support load,
  churn, gross margin, and customer outcome evidence.
- Legal approval of policies, retention, deletion/export operations, and support
  commitments.

## Access register

| Capability | Current evidence | Approval or owner action |
|---|---|---|
| Private GitHub repository | Read/write connector available; drafts only | Merge and production release require explicit approval |
| GitHub Actions | Runs visible but fail before steps | Owner resolves account billing/spending; no spend change was made |
| Local checkout | No usable Fleetvera checkout in the shared workspace | Optional after GitHub access is restored locally |
| Public deployment | Read-only HTTPS checks available | Production mutation requires explicit approval |
| Production host/database | No current authenticated access in this work cycle | Owner grants narrowly scoped access for approved verification |
| Stripe/Mailgun/OAuth | Configuration and delivery unverified | Owner supplies approved sandbox/live evidence and credentials |
| Monitoring/analytics/support | No current operational evidence | Owner identifies systems and grants read-only access |
| Customers/pilot | No direct evidence available | Owner recruits/approves pilot and data permissions |

Never place credential values or production data in this file, issues, logs, or
test fixtures.

## Primary objective

Restore executable CI and produce one exact, reviewable merge candidate from the
draft hardening work.

Acceptance criteria:

1. The GitHub Actions quality and production-container jobs execute on the exact
   candidate commit.
2. Dependency audit, lint, strict TypeScript, Jest, production build, container
   build/startup, migrations, and the defined release E2E command pass.
3. Stacked and overlapping drafts are reconciled without dropping tests or
   invariants.
4. The candidate has a documented migration order, rollback plan, and no known
   critical or high-severity finding.
5. Deployment remains unapproved until external release gates are attached and
   the owner explicitly approves the exact action.

## Authoritative roadmap

| Priority | Outcome | Evidence / acceptance | Status |
|---|---|---|---|
| P0 | Restore GitHub Actions execution | Quality and container jobs expose steps and pass on candidate | Blocked by owner billing/spending action |
| P0 | Reconcile tenant/auth/concurrency drafts | Merge train below rebased, reviewed, and green without lost invariants | In progress |
| P0 | Prove data recovery | Retained encrypted backup restored in isolation; elapsed time and integrity checks recorded | Proposed |
| P0 | Prove production configuration | Read-only preflight passes without revealing values; migration path rehearsed | Proposed |
| P0 | Prove authenticated critical paths | Owner, dispatcher, technician, driver, and viewer smoke journeys pass on desktop/mobile | Proposed |
| P0 | Prove external providers | Stripe, email, document, OAuth, monitoring, and alert evidence attached | Proposed |
| P1 | Reconcile operator documentation | #80-#82 plus this control record reviewed; stale instructions marked historical | In progress |
| P1 | Harden repository governance | PR review, no force-push/deletion, required up-to-date checks, and constrained bypass | Proposed; settings change needs approval |
| P1 | Complete accessibility/performance evidence | WCAG critical paths plus current LCP/INP/CLS thresholds measured | Proposed |
| P1 | Run controlled pilot | Written permission, onboarding, four-week evidence, incident/support log | Owner-dependent |
| P2 | Validate positioning and pricing | Current competitor research, customer interviews, unit economics, decision rule | Researched only; not validated |

## Draft merge train

All entries are **implemented in drafts**, not verified or released.

1. Operational foundations: #80 configuration/runtime, then stacked #108
   fail-closed preflight-before-migration startup; #81 historical guidance, #82
   unsafe scripts, and #84 backup/restore verifier are merge-independent.
2. Tenant and membership invariants: #78 tenant/login isolation, then #83
   ownership invariant. #83 incorporates #79; close #79 as superseded only
   after the combined diff and tests are verified.
3. Authentication and privileged operations: #85 backup codes, #86 2FA
   enrollment, then #107 session/origin boundaries; explicitly reconcile #85
   and #107 in `pages/api/auth/2fa/validate.ts`. Continue with #87 maintenance
   share issuance, #91 bootstrap wrapper, and #92 admin mutations.
4. Cron ordering: #89 strict cron authentication, then stacked #90 reminder
   claims.
5. Tenant business mutations: #93 deliveries, #94 vehicles, #95 maintenance,
   #96 clients, #97 vending, #98 announcements, #99 notifications, #100 SOP.
   #97 and #98 both edit `lib/validation.ts`; reconcile explicitly.
6. Remaining integrity/resource controls: #101 document confirmation, #102
   reports, #103 search/activity, #104 user settings.
7. Product and billing control: #105 authoritative product control, then #106
   serialized/idempotent Stripe lifecycle hardening. Verify the supported Stripe
   SDK/API upgrade separately after lockfile regeneration and executable CI.

Before merging, rebase each logical group onto the candidate, resolve conflicts,
run focused tests, then run the full release gate. Do not merge drafts merely
because GitHub reports them mergeable.

## Risk register

| Risk | Severity | Current control | Release consequence |
|---|---|---|---|
| CI cannot execute repository steps | High | Drafts remain unmerged | No candidate approval |
| Many independent drafts can conflict or omit invariants | High | Explicit merge train and diff review | No bulk merge |
| Production revision/configuration unknown | High | Public checks treated as availability only; #80/#108 configuration and startup gates | No deployment approval |
| Custom JWT runtime still carries legacy NextAuth packages/types | Medium | #80 documents truth; lockfile cleanup deferred | Remove only with regenerated lockfile and executable CI |
| Auth session transition/origin invariants unverified | High | #107 implements guards, explicit token purpose, cookie invalidation | No auth candidate approval until #85/#86/#107 are reconciled and green |
| Backup retention and timed restore unproved | High | August 13 ephemeral drill is dated evidence | No pilot with material data |
| External provider delivery unproved | High | Fail-closed configuration proposals; #106 billing hardening | Affected capability disabled |
| Stripe Tax registration/configuration unknown | High legal/commercial | Automatic tax not enabled by #106 | No automatic tax change without owner and qualified tax approval |
| Repository rules allow broad bypass and omit review protections | High | Documented for owner decision | No unattended release |
| Stale operational/product documents remain | Medium | #81 and historical banner work | Operators use only current index/runbooks |
| Customer value, retention, and unit economics unknown | High commercial | Invitation-only positioning | No market-leading or PMF claim |

## Decisions

- Keep production mutations, merges, repository-rule changes, spending changes,
  pricing changes, and external communications behind explicit owner approval.
- Treat all draft PRs as implemented but unverified while CI is unable to run.
- Use PostgreSQL advisory locks or equivalent transactional claims for
  cross-request invariants, with focused concurrency tests.
- Preserve invitation-only availability until provider, recovery, monitoring,
  legal, and pilot evidence clears.
- Do not claim the product is market-leading or customer-validated without
  direct behavioral evidence.

## Metrics and validation plan

Baselines are currently unknown. The controlled pilot must establish:

- invitation accepted to first useful fleet record and first resolved exception;
- weekly active owner/dispatcher operators and four-week retention;
- successful delivery/maintenance task completion and correction rates;
- document/AI preview acceptance, correction, refusal, latency, and cost;
- authorization, provider, recovery, and support incidents;
- subscription conversion, churn, infrastructure/provider cost, and support time.

Targets must be approved after baseline and competitor/customer research; they
must not be invented to satisfy a release checklist.

## Work log

- 2026-08-28: audited current `master`, repository governance, privileged
  mutations, concurrency paths, reports, documents, settings, search, and
  activity; opened evidence-backed drafts #78-#104.
- 2026-08-28: confirmed public health, landing, and pricing availability
  read-only; no authenticated production action or external provider call.
- 2026-08-28: established this control index and marked the obsolete root
  `TODO.md` as historical.
- 2026-08-28: opened #106 to serialize and make Stripe checkout/cancellation
  idempotent, bound webhook bodies, and protect billing reads. CI run 33199548149
  failed before steps; Stripe SDK/API upgrade and live Tax/provider evidence remain unresolved.
- 2026-08-28: opened #107 for same-origin auth mutations, explicit session-token
  purpose, centralized cookie invalidation, production JWT secret enforcement, and
  private/no-store auth responses. CI run 33203949669 failed before steps and the
  production-container job was skipped.
- 2026-08-28: opened #108, stacked on #80, to require an explicit pilot/public
  release mode and run the production readiness verifier before any migration.
  The PR targets master so the exact combined head is eligible for CI. Run
  33204309209 failed before steps and the production-container job was skipped.

## Release decision

**Not approved.** The next highest-leverage action is restoring GitHub Actions
execution, then building and validating the exact merge candidate above. Public
availability is not launch evidence.
