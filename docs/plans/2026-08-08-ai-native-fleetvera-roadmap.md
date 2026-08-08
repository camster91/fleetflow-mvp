# Fleetvera AI-Native Product Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn Fleetvera from a polished fleet system of record into an AI-assisted operations product for small service and delivery fleets, while completing the remaining public-launch requirements.

**Architecture:** Keep PostgreSQL and Prisma as the source of truth. Build a deterministic, tenant-scoped intelligence layer that produces explainable findings from fleet records, then let a provider-neutral AI layer summarize those findings and answer read-only questions with record citations. Any AI-proposed write must use an existing validated API, require explicit user confirmation, and create an audit record.

**Tech Stack:** Next.js Pages Router, React 19, TypeScript, Prisma/PostgreSQL, Jest, Playwright, existing notification/audit infrastructure, provider-neutral server-side LLM adapter.

---

## Product boundaries

- Initial customer: a small service or delivery fleet moving off spreadsheets.
- Initial promise: “Know what needs attention today and handle it before it becomes expensive.”
- AI may summarize, rank, explain, and draft.
- AI may not silently modify fleet records, contact people, make purchases, or invent missing facts.
- Every recommendation must expose its supporting Fleetvera records and the rule/model that produced it.
- Predictive claims remain “risk indicators” until validated against sufficient real customer history.

## Release sequence

1. Public-launch plumbing
2. Data quality and event foundation
3. Fleet Intelligence Brief
4. Ask Fleetvera, read-only
5. Suggested actions with confirmation
6. Document intake
7. First integrations
8. Validated risk scoring

---

### Task 1: Complete transactional email readiness

**Objective:** Make login codes and team invitations deliver reliably in production.

**Files:**
- Modify: `lib/email.ts`
- Modify: `services/emailService.ts`
- Modify: `pages/api/auth/send-code.ts`
- Test: `__tests__/api/auth.send-code.test.ts`
- Create: `docs/runbooks/transactional-email.md`

**Steps:**

1. Add a failing API test proving a provider failure returns a generic response to the user but records a structured server error with a correlation ID.
2. Consolidate the two Mailgun implementations behind one server-only adapter.
3. Add a startup readiness check for provider key, verified sending domain, sender address, and application URL.
4. Document DNS, provider setup, smoke-test recipient, and rollback procedure.
5. Run `npm test -- --runInBand __tests__/api/auth.send-code.test.ts` and expect all tests to pass.
6. Send one production login code and one disposable invitation; verify receipt and remove the disposable records.
7. Commit: `fix(email): complete transactional delivery readiness`.

**Gate:** No public registrations or invitations until inbox delivery is verified.

### Task 2: Complete Stripe launch readiness

**Objective:** Make subscription purchase, webhook synchronization, invoices, cancellation, and failure states trustworthy.

**Files:**
- Modify: `pages/api/stripe/checkout-session.ts`
- Modify: `pages/api/stripe/webhook.ts`
- Modify: `pages/billing/index.tsx`
- Modify: `lib/stripe.ts`
- Test: `__tests__/api/billing.test.ts`
- Test: `__tests__/api/stripe.webhook.test.ts`
- Create: `docs/runbooks/stripe-launch.md`

**Steps:**

1. Write failing tests for missing configuration, duplicate webhook delivery, failed payment, cancellation, and plan mismatch.
2. Add a server endpoint that reports billing availability without exposing secrets.
3. Disable checkout controls and explain the unavailable state when Stripe is not configured.
4. Make webhook processing idempotent and audit subscription transitions.
5. Run the focused billing tests, then `npm run build`.
6. Complete a Stripe sandbox purchase, renewal webhook, failed-payment event, invoice view, cancellation, and refund.
7. Commit: `feat(billing): finish subscription launch flow`.

**Gate:** Do not charge customers until every sandbox scenario passes.

### Task 3: Make API access real or explicitly unavailable

**Objective:** Ensure generated API keys authenticate a documented, scoped API rather than existing as an isolated settings feature.

**Files:**
- Modify: `lib/apiAuth.ts`
- Modify: `pages/api/settings/api-keys.ts`
- Create: `pages/api/v1/vehicles/index.ts`
- Create: `pages/api/v1/maintenance/index.ts`
- Create: `pages/api/v1/deliveries/index.ts`
- Create: `pages/api/v1/me.ts`
- Create: `pages/api/docs.tsx`
- Test: `__tests__/pages/api/v1.auth.test.ts`

**Steps:**

1. Write failing tests for valid, revoked, malformed, cross-tenant, and missing bearer keys.
2. Add `requireApiKey()` using the existing token hash and constant-time comparison helpers.
3. Store scopes and enforce read-only scopes in the first release.
4. Expose bounded, paginated, tenant-scoped read endpoints.
5. Update `lastUsedAt` without blocking the request.
6. Document authentication, pagination, rate limits, errors, and examples.
7. Run focused API tests, the full suite, and a real curl smoke test with a disposable key.
8. Commit: `feat(api): add scoped read-only public API`.

### Task 4: Add data-quality signals

**Objective:** Identify missing or unreliable records before generating recommendations.

**Files:**
- Create: `lib/intelligence/dataQuality.ts`
- Create: `pages/api/intelligence/data-quality.ts`
- Create: `components/intelligence/DataQualityCard.tsx`
- Modify: `pages/dashboard.tsx`
- Test: `__tests__/lib/intelligence.dataQuality.test.ts`

**Core contract:**

```ts
export interface DataQualityIssue {
  id: string
  entityType: 'vehicle' | 'delivery' | 'maintenance' | 'client'
  entityId: string
  severity: 'high' | 'medium' | 'low'
  field: string
  message: string
  actionUrl: string
}
```

**Steps:**

1. Write table-driven failing tests for missing mileage, vehicle assignment, dates, costs, contact data, and stale updates.
2. Implement deterministic checks with no model calls.
3. Return counts plus the highest-impact issues from a tenant-scoped endpoint.
4. Add a dashboard card linking directly to each affected record.
5. Verify empty, partial, and large workspaces.
6. Commit: `feat(intelligence): surface fleet data quality issues`.

### Task 5: Create the deterministic intelligence engine

**Objective:** Produce explainable, prioritized operational findings from existing Fleetvera records.

**Files:**
- Create: `lib/intelligence/types.ts`
- Create: `lib/intelligence/rules.ts`
- Create: `lib/intelligence/generateFindings.ts`
- Test: `__tests__/lib/intelligence.rules.test.ts`

**Initial findings:**

- Overdue or soon-due maintenance
- Repeated maintenance cost concentration
- Vehicles with no recent update
- Deliveries at risk because scheduled time has passed
- Vehicles with unusually high delivery load
- Unassigned deliveries
- Records that block reliable analysis

**Steps:**

1. Define a `Finding` with severity, confidence, explanation, evidence references, recommended action, and expiry.
2. Write one failing test per rule, including boundary dates and empty datasets.
3. Implement pure rule functions with stable IDs and deterministic ordering.
4. Add a final ranker using severity, urgency, and evidence completeness.
5. Confirm every output can be reproduced without an LLM.
6. Commit: `feat(intelligence): add explainable fleet findings engine`.

### Task 6: Persist findings and user feedback

**Objective:** Track what Fleetvera recommended and whether the recommendation was useful.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_intelligence_findings/migration.sql`
- Create: `pages/api/intelligence/findings.ts`
- Test: `__tests__/pages/api/intelligence.findings.test.ts`

**Schema:**

```prisma
model IntelligenceFinding {
  id             String   @id
  teamId         String
  type           String
  severity       String
  confidence     Float
  title          String
  explanation    String
  evidence       String
  action         String?
  status         String   @default("OPEN")
  feedback       String?
  generatedAt    DateTime @default(now())
  expiresAt      DateTime?
  resolvedAt     DateTime?
  @@index([teamId, status, severity])
}
```

**Steps:**

1. Add migration tests and tenant-isolation API tests.
2. Upsert stable findings so repeated generation does not create duplicates.
3. Support dismiss, resolve, helpful, and not-helpful feedback.
4. Audit all state changes.
5. Commit: `feat(intelligence): persist findings and feedback`.

### Task 7: Build the Fleet Intelligence Brief

**Objective:** Replace passive dashboard statistics with a daily “what needs attention” workflow.

**Files:**
- Create: `components/intelligence/IntelligenceBrief.tsx`
- Create: `components/intelligence/FindingCard.tsx`
- Create: `pages/api/intelligence/brief.ts`
- Modify: `pages/dashboard.tsx`
- Test: `__tests__/components/IntelligenceBrief.test.tsx`
- Test: `e2e/intelligence-brief.spec.ts`

**Steps:**

1. Write component tests for loading, empty, high-risk, dismissed, and incomplete-data states.
2. Show the top five findings with evidence, urgency, and one primary action.
3. Add “Why am I seeing this?” and source-record links.
4. Add feedback controls and a “View all” route.
5. Verify keyboard use and 375px layout.
6. Commit: `feat(dashboard): add daily fleet intelligence brief`.

**Success measure:** In pilot sessions, an owner can identify the most urgent issue and reach the relevant record in under 30 seconds.

### Task 8: Add a provider-neutral AI adapter

**Objective:** Allow grounded summaries without coupling Fleetvera to one model vendor.

**Files:**
- Create: `lib/ai/types.ts`
- Create: `lib/ai/provider.ts`
- Create: `lib/ai/prompts.ts`
- Create: `lib/ai/redaction.ts`
- Test: `__tests__/lib/ai.provider.test.ts`
- Modify: `.env.example`

**Steps:**

1. Define structured request/response types with schema validation.
2. Write tests for timeout, malformed output, unavailable provider, token limits, and redaction.
3. Send only the minimum tenant-scoped fields required for the current question.
4. Require structured JSON output and reject uncited claims.
5. Add request IDs, latency, usage, and failure metrics without logging sensitive payloads.
6. Provide a deterministic fallback summary when AI is unavailable.
7. Commit: `feat(ai): add safe provider-neutral inference adapter`.

### Task 9: Build Ask Fleetvera as read-only Q&A

**Objective:** Answer operational questions using only authorized Fleetvera data and visible citations.

**Files:**
- Create: `pages/assistant.tsx`
- Create: `pages/api/assistant/query.ts`
- Create: `lib/ai/queryPlanner.ts`
- Create: `lib/ai/fleetTools.ts`
- Create: `components/assistant/AnswerWithSources.tsx`
- Modify: `components/layouts/DashboardLayout.tsx`
- Test: `__tests__/pages/api/assistant.query.test.ts`
- Test: `e2e/assistant.spec.ts`

**Supported first questions:**

- What needs attention today?
- What maintenance is overdue or due soon?
- Which vehicles have the highest recorded maintenance cost?
- Which deliveries are late, incomplete, or unassigned?
- Summarize activity for a selected date range.

**Steps:**

1. Write authorization and unsupported-question tests before UI work.
2. Implement a fixed tool allowlist over existing tenant-scoped query functions.
3. Return record IDs, labels, and links with every factual answer.
4. Refuse questions requiring unavailable data rather than guessing.
5. Add suggested prompts, loading feedback, cancellation, and retry.
6. Run prompt-injection, cross-tenant, empty-data, and mobile tests.
7. Commit: `feat(ai): add grounded read-only fleet assistant`.

### Task 10: Add approval-based suggested actions

**Objective:** Let users act on recommendations without allowing autonomous mutations.

**Files:**
- Create: `lib/ai/actionRegistry.ts`
- Create: `components/assistant/ActionPreview.tsx`
- Create: `pages/api/assistant/actions/execute.ts`
- Modify: `lib/fleet.ts`
- Test: `__tests__/pages/api/assistant.actions.test.ts`

**Allowed initial actions:**

- Draft a maintenance task
- Draft a delivery status update
- Draft a weekly fleet summary
- Open the relevant edit screen with prefilled values

**Steps:**

1. Test role authorization, stale-record conflicts, tampered payloads, duplicate submissions, and audit logging.
2. Validate every action with the same schemas as the normal UI.
3. Show an exact before/after preview.
4. Require an explicit confirmation button for every write.
5. Record proposer, confirmer, source finding, and final result.
6. Commit: `feat(ai): add confirmed fleet actions`.

### Task 11: Add document intelligence

**Objective:** Turn service invoices and inspection records into reviewable structured drafts.

**Files:**
- Create: `pages/documents.tsx`
- Create: `pages/api/documents/upload.ts`
- Create: `pages/api/documents/[id]/extract.ts`
- Create: `lib/documents/extraction.ts`
- Modify: `prisma/schema.prisma`
- Test: `__tests__/pages/api/documents.test.ts`

**Steps:**

1. Define supported PDF/image types, size limits, retention, and deletion policy.
2. Scan uploads, store them privately, and prevent public URLs.
3. Extract vendor, vehicle, date, odometer, services, parts, subtotal, tax, and total.
4. Display side-by-side source and extracted fields with confidence indicators.
5. Require confirmation before creating a maintenance record or expense.
6. Test malformed, malicious, duplicate, and low-confidence documents.
7. Commit: `feat(documents): add reviewed service record extraction`.

### Task 12: Deliver the first two integrations

**Objective:** Feed Fleetvera enough live data to make its intelligence useful.

**Recommended order:** Google Maps for delivery/location workflows, then QuickBooks Online for maintenance and operating costs. Confirm this order with pilot customers before implementation.

**Files:**
- Modify: `pages/settings/integrations.tsx`
- Create: `lib/integrations/types.ts`
- Create: `lib/integrations/oauth.ts`
- Create: `pages/api/integrations/[provider]/connect.ts`
- Create: `pages/api/integrations/[provider]/callback.ts`
- Create: `pages/api/integrations/[provider]/sync.ts`
- Modify: `prisma/schema.prisma`
- Test: `__tests__/pages/api/integrations.test.ts`

**Steps:**

1. Interview at least five target operators and record which two integrations remove the most manual work.
2. Store encrypted OAuth credentials with scopes, expiry, and revocation metadata.
3. Add idempotent sync jobs and per-record provenance.
4. Display last sync, next sync, errors, and reconnect controls.
5. Test expired tokens, provider downtime, duplicate data, and disconnect cleanup.
6. Commit each provider independently.

### Task 13: Add transparent maintenance risk scoring

**Objective:** Rank maintenance attention using explainable operational evidence before attempting machine-learning prediction.

**Files:**
- Create: `lib/intelligence/maintenanceRisk.ts`
- Modify: `pages/api/analytics/dashboard.ts`
- Create: `components/intelligence/MaintenanceRiskBadge.tsx`
- Test: `__tests__/lib/maintenanceRisk.test.ts`

**Inputs:** overdue days, mileage since service, repeated task category, recorded cost trend, vehicle age, open maintenance flags, and data completeness.

**Steps:**

1. Define a published scoring rubric and write boundary tests.
2. Return score, risk band, contributing factors, and missing-data warnings.
3. Never express a probability of failure without validated historical labels.
4. Add pilot feedback and outcome capture.
5. Consider an ML model only after sufficient outcome data exists and offline evaluation beats the rules baseline.
6. Commit: `feat(intelligence): add transparent maintenance risk score`.

### Task 14: Create role-specific command centres

**Objective:** Give each role a focused home screen rather than the same information hierarchy.

**Files:**
- Modify: `pages/dashboard.tsx`
- Modify: `components/role-dashboards/AdminDashboard.tsx`
- Modify: `components/role-dashboards/DispatchDashboard.tsx`
- Modify: `components/role-dashboards/DriverDashboard.tsx`
- Create: `components/role-dashboards/MaintenanceDashboard.tsx`
- Test: `__tests__/pages/dashboard.roles.test.tsx`

**Steps:**

1. Define the top three decisions and top three actions for owner, dispatcher, technician, and driver.
2. Remove demo/static role data and connect all panels to tenant-scoped APIs.
3. Put exceptions and assignments above charts.
4. Keep driver mobile interactions one-handed with 44px minimum targets.
5. Test every role at 375px and desktop, including unauthorized routes.
6. Commit: `feat(ux): add role-specific operations dashboards`.

### Task 15: Add AI observability, controls, and evaluation

**Objective:** Make AI quality, cost, latency, and safety measurable before broad release.

**Files:**
- Create: `lib/ai/telemetry.ts`
- Create: `lib/ai/evaluation.ts`
- Create: `__tests__/fixtures/ai-evaluation-cases.json`
- Create: `pages/admin/ai-health.tsx`
- Create: `docs/runbooks/ai-incident-response.md`

**Steps:**

1. Create an evaluation set covering supported questions, missing data, adversarial instructions, and tenant isolation.
2. Score citation accuracy, unsupported claims, tool selection, latency, and cost.
3. Add workspace-level AI enablement and retention controls.
4. Add a provider kill switch and deterministic fallback.
5. Block release when any cross-tenant test fails or citation accuracy falls below the agreed threshold.
6. Commit: `feat(ai): add quality and safety controls`.

### Task 16: Pilot and launch gate

**Objective:** Prove the product solves a recurring operational problem before scaling the roadmap.

**Pilot:** Five to ten small fleets for four weeks, using real operational records with written permission.

**Measure:**

- Weekly active owners and operators
- Time from opening Fleetvera to first useful action
- Findings viewed, acted on, dismissed, and rated helpful
- Overdue maintenance discovered and resolved
- Delivery exceptions found before customer impact
- Data-quality completion rate
- Assistant citation accuracy and refusal quality
- Support incidents and onboarding completion

**Launch criteria:**

- Transactional email and Stripe production flows pass.
- API surface is functional or removed from marketing.
- No unresolved critical browser, authorization, accessibility, or data-integrity defects.
- Every AI answer is tenant-scoped and source-backed.
- Every AI write requires confirmation and is audited.
- Mobile owner, dispatcher, technician, and driver workflows pass.
- Backup restoration and rollback are tested.
- Pilot users repeatedly act on the Intelligence Brief without coaching.

**Final verification:**

```powershell
npm run lint
npm run typecheck
npm run test:ci
npm run build
npm run test:e2e
```

Then deploy with the existing rollback-safe VPS process and repeat authenticated desktop/mobile browser QA against production.

---

## Recommended first implementation milestone

Complete Tasks 1–7 before building a conversational assistant. That milestone makes Fleetvera publicly operable and gives customers immediate intelligence without model risk. Tasks 8–10 then turn the proven findings into an AI-native experience. Do not start document extraction, integrations, or predictive claims until pilot feedback confirms the underlying workflow priorities.
