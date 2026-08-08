# Intelligence Brief Integrated Browser QA

Use `scripts/run-intelligence-integrated-qa.ps1` for the final pre-release check against a disposable PostgreSQL container. The script owns its database, ports, test secrets, records, production server, and cleanup; it must never target a user or production database.

## Running the harness

- Docker must be available locally.
- Ports 55439 and 3110 must be free, or pass alternate `-PostgresPort` and `-Port` values.
- Run `powershell -ExecutionPolicy Bypass -File .\scripts\run-intelligence-integrated-qa.ps1` from the repository root.

The harness rehearses both supported migration paths before browser QA: an upgrade through the previously shipped `20260808020000_intelligence_findings` migration followed by `20260808030000_intelligence_runs`, with a seeded finding preserved across the upgrade, and a separate fresh database applying every migration.

## Automated coverage split

- `e2e/intelligence-integrated.spec.ts` uses real authentication cookies, APIs, Prisma transactions, PostgreSQL rows, and audit logs. It covers workspace isolation, manager/viewer/anonymous authorization, CSRF rejection, refresh/run persistence, feedback no-op and switching semantics, lifecycle/status filters, expiration, signed-cursor pagination, evidence redaction, and real source-record navigation. It does not mock intelligence routes.
- `e2e/intelligence-brief.spec.ts` intentionally mocks routes to deterministically exercise the 375 px UI contract: loading the top issue, keyboard disclosure, canonical links, feedback, dismissal, and horizontal overflow. Jest component tests cover optimistic overlap, rollback, and focus restoration failures that would be unsafe or flaky to manufacture in the integrated database path.

## Manual release supplement

1. Open `/dashboard` and confirm the real `/api/auth/me` request returns the disposable database user.
2. Use **Refresh** in "What needs attention today." Confirm the real POST creates or reconciles `IntelligenceFinding` rows and an `IntelligenceRun` in PostgreSQL.
3. Reload without request interception. Confirm the brief returns no more than five current `OPEN` rows in score-descending, ID-ascending order.
4. Expand "Why am I seeing this?" with the keyboard. Follow action and evidence links to their matching source records.
5. Exercise feedback, dismiss, resolve, and every status filter while comparing the UI to persisted finding and audit rows.
6. Repeat at 375 px and desktop widths, checking focus after removal and after a deliberately forced API failure.

Record the database snapshot identifier, browser version, commands, screenshots, and cleanup result in the release QA report. A mocked Playwright pass must never be reported as completion of the integrated path.
