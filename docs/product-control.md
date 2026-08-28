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
- Draft PRs #78 through #116 contain unmerged security, concurrency,
  configuration, operations, billing, product-control, and reliability changes.
  PRs #88, #109, and #110 are closed and superseded; #111 is the authoritative
  focused PostgreSQL-default remediation.
- Recent GitHub Actions runs, including #111 run 33205110750, complete the quality
  job as failed before repository steps are exposed; the production-container
  job is skipped. The account billing/spending gate must
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

1. Operational foundations: #113 is the cumulative #80 + #108 + #111 candidate,
   reconciling configuration/runtime, fail-closed preflight-before-migration
   startup, and the complete PostgreSQL-default remediation. After #113 is reviewed
   and green, close #80, #108, and #111 as superseded. #81 historical guidance,
   #82 unsafe scripts, and #84 backup/restore verifier remain merge-independent.
2. Tenant and membership invariants: #78 tenant/login isolation, then #83
   ownership invariant. #83 incorporates #79; close #79 as superseded only
   after the combined diff and tests are verified.
3. Authentication and privileged operations: #112 is the cumulative #107 + #85
   candidate and explicitly reconciles atomic backup-code consumption with
   session/origin boundaries. After #112 is reviewed and green, close #85 and
   #107 as superseded. Reconcile independent #86 2FA enrollment next, then
   continue with #87 maintenance share issuance, #91 bootstrap wrapper, and #92
   admin mutations.
4. Cron ordering: #89 strict cron authentication, then stacked #90 reminder
   claims.
5. Tenant business mutations: #115 is the cumulative #93-#100 candidate. It
   includes #114's explicit #97/#98 `lib/validation.ts` reconciliation and every
   handler/test from #93, #94, #95, #96, #99, and #100. Its 27-file manifest
   exactly matches the source union. After #115 is reviewed and green, close
   #93-#100 and #114 as superseded.
6. Remaining integrity/resource controls: #116 is the cumulative #101-#104
   candidate for document confirmation, bounded reports, secure search/activity,
   and user settings. Its 20-file manifest exactly matches the source union. After
   #116 is reviewed and green, close #101-#104 as superseded.
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
| Production revision/configuration unknown | High | Public checks treated as availability only; cumulative #113 configuration, database, and startup gates | No deployment approval |
| Default PostgreSQL credential may have been deployed and database is host-published on master | High if deployed; exposure unknown | #113 cumulatively retains #111's focused remediation with #80/#108 runtime controls | Determine usage; rotate with approval if ever deployed; no candidate approval without disposition |
| Custom JWT runtime still carries legacy NextAuth packages/types | Medium | #80 documents truth; lockfile cleanup deferred | Remove only with regenerated lockfile and executable CI |
| Auth session transition/origin invariants unverified | High | #112 cumulatively reconciles #107 guards/session lifecycle with #85 atomic backup-code consumption | No auth candidate approval until #112 and independent #86 are reconciled and green |
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
- 2026-08-28: validated GitGuardian incident 36683862 against commit c118789 and
  current master: the compose default PostgreSQL password is real repository
  content and the database host port is published. #80 removes both, but whether
  the credential was deployed and needs approved rotation remains unknown.
- 2026-08-28: opened focused draft #111 from current master after closing #109
  and #110 as superseded because their test commit history caused additional
  secret-scanner incidents. #111 changes only `.env.example`, `docker-compose.yml`,
  and the release-gate test. GitGuardian reports only incident 36683862 on the
  commit deleting the original compose credential; it reports no final-test
  occurrence. CI run 33205110750 failed before exposing steps and skipped the
  production-container job, so the remediation is implemented but verification
  remains blocked. No rotation, merge, deployment, or production mutation occurred.
- 2026-08-28: opened cumulative auth draft #112 targeting master to reconcile
  #107 session/origin protections with #85 atomic backup-code consumption. The
  direct overlap is limited to the 2FA validate handler and its focused test;
  #112 preserves both invariants and carries the independent disable-path tests.
  CI run 33205454731 failed before exposing steps and skipped the container job.
  #85 and #107 remain open until the cumulative candidate is independently
  reviewed and green.
- 2026-08-28: opened cumulative production-startup draft #113 targeting master
  to reconcile #80/#108 runtime and fail-closed startup controls with #111's
  complete database-example remediation. The combined patch is mergeable;
  GitGuardian reports only inherited incident 36683862 on deletion of the original
  compose credential and no release-test occurrence. CI run 33205615419 failed
  before exposing steps and skipped the container job. #80, #108, and #111 remain
  open until #113 is independently reviewed and green.
- 2026-08-28: opened cumulative business-mutation draft #114 targeting master
  to reconcile #97 vending and #98 announcement controls. Their only overlap,
  `lib/validation.ts`, now contains both schema families; the seven-file diff also
  carries both focused mutation suites and both scoped handler pairs. CI run
  33205832571 failed before exposing steps and skipped the container job. #97 and
  #98 remain open until #114 is independently reviewed and green.
- 2026-08-28: opened cumulative tenant business-mutation draft #115 targeting
  master from #114 plus #93, #94, #95, #96, #99, and #100. The 27-file candidate
  manifest exactly matches the union of its source drafts with no missing or
  unexpected paths. CI run 33206081436 failed before exposing steps and skipped
  the container job. All predecessors remain open until #115 is independently
  reviewed and green.
- 2026-08-28: opened cumulative resource/read-integrity draft #116 targeting
  master from #101-#104. Its 20-file manifest exactly matches the source union,
  covering document review state, bounded reporting, secure read queries, and
  settings integrity. CI run 33206279435 failed before exposing steps and skipped
  the container job. #101-#104 remain open until #116 is independently reviewed
  and green.

## Release decision

**Not approved.** The next highest-leverage action is restoring GitHub Actions
execution, then building and validating the exact merge candidate above. Public
availability is not launch evidence.
