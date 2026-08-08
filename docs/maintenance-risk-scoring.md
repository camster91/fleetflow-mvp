# Maintenance attention scoring

Fleetvera rubric `maintenance-risk-v1` is a deterministic prioritization aid. It does not estimate a probability, predict a breakdown, or claim that a vehicle will fail. The score is recalculated from tenant-scoped records using an injected UTC timestamp.

## Rubric

| Recorded indicator | Points |
| --- | ---: |
| Oldest open task 1–7 full days overdue | 10 |
| Oldest open task 8–30 full days overdue | 20 |
| Oldest open task 31+ full days overdue | 30 |
| 5,000–9,999 recorded distance units since service | 6 |
| 10,000+ recorded distance units since service | 12 |
| Two open tasks in the same category | 8 |
| Three or more open tasks in the same category | 12 |
| Recent recorded cost average rises at least 25% and 100 major currency units | 10 |
| Recent recorded cost average rises at least 75% and 100 major currency units | 15 |
| Vehicle age 8–11 calendar years | 5 |
| Vehicle age 12+ calendar years | 10 |
| Vehicle record has an open maintenance-due flag | 15 |

Bands are low (0–24), watch (25–49), and high (50–100). The score is capped at 100. Each family contributes at most its highest applicable tier, preventing tier double counting. A generic vehicle maintenance-due flag does not add points when a scored overdue-task factor already represents the same condition. Factors are ranked by points and then stable code; records within factors are ordered by ID. The service-mileage interval and last-service date are not added together as separate risk factors because they can describe the same service interval.

## Data handling and limitations

- Dates must be exact ISO UTC timestamps. Invalid, future, or stale service dates create warnings instead of inferred facts.
- Mileage and costs must be finite, non-negative, and within documented defensive bounds.
- Cost trend requires at least four completed tasks with valid actual costs and exact completion dates, a configured three-letter `MAINTENANCE_RISK_CURRENCY`, and values stored in major currency units. It compares equal chronological halves. Missing/invalid observations are counted and warned about; without enough comparable observations, the cost input remains unavailable and no cost points are assigned.
- Completed tasks never receive overdue or repeated-open-task points.
- The API reads at most 100 vehicles and 2,000 maintenance tasks and reports whether either source was truncated. A task-limit hit marks every returned vehicle score `sourceComplete: false` and adds a warning, so a bounded partial read cannot appear complete. Only the top ten vehicles are returned.
- The current database does not record mileage at the moment of service, so the dashboard reports that input as missing rather than deriving it from current mileage.

## Pilot feedback and outcomes

Authenticated analytics users except view-only users may voluntarily submit pilot feedback from an expanded score. Explicit consent is required. Fleetvera recomputes the tenant-scoped score server-side and records the vehicle, rubric version, score/band snapshot, evidence-source completeness, input-completeness percentage, helpful/not-helpful response, whether an action was taken, a bounded operational outcome category, optional notes, submitter, and consent timestamp. Notes are capped at 500 characters and excluded from audit metadata; the UI warns users to include only necessary personal information. Feedback expires after 180 days and is removed by `POST /api/cron/maintenance-risk-retention` using the configured `CRON_SECRET`. A submitter may withdraw their own scoped feedback immediately from the score UI. Feedback is also deleted with its owner, team, vehicle, or submitter.

Submissions require same-origin browser context and a bounded `Idempotency-Key`. A canonical SHA-256 request fingerprint is stored with the key. Identical retries return the original row; changed vehicle or feedback content with the same key returns `409` without another write or audit. The database uniqueness constraint makes concurrent replay durable. A durable per-user/workspace quota is consumed before vehicle/task scoring. Withdrawal remains available after role demotion, but is exact-workspace- and submitter-scoped and creates a metadata-only audit record.

Operational outcome categories are service scheduled, service completed, monitoring records, no further action, and other operational outcome. These observations support later offline evaluation but are not breakdown labels or predictions. Do not train or market a predictive model until sufficient consented history exists and an offline evaluation demonstrably beats this rules baseline.

## QA evidence

On 2026-08-08, automated coverage verified scoring boundaries, invalid and missing inputs, UTC timestamps, completed-task handling, repeated categories, cost units, stale records, stable ordering, source links, tenant scope, legacy owner-row scope, bounded empty/large reads, consent and role enforcement, audit creation, accessible disclosure, and non-predictive wording. Fresh migration, historical upgrade, and schema no-diff checks passed on disposable PostgreSQL 16. Chromium browser QA at 375 × 812 verified keyboard expansion, visible evidence and missing-data warnings, working source navigation, consented feedback submission, no horizontal overflow, and no console errors. Re-run with:

```bash
npm test -- --runInBand __tests__/lib/maintenanceRisk.test.ts __tests__/pages/api/analytics.maintenance-risk.test.ts __tests__/components/MaintenanceRiskBadge.test.tsx
PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3213 npx playwright test e2e/maintenance-risk.spec.ts --project=chromium
```
