# Free beta launch on the Ashbi VPS (Coolify)

The ordered checklist for putting the free beta live on the Ashbi VPS. It links to the
detailed runbooks rather than repeating them. Tracking issues: #138 (epic) and #155 (deploy).

Never paste secret values, database URLs, or customer data into GitHub, logs, or chat.

## 0. Decide before starting

- [ ] **Public hostname.** Docs and guards name both `fleet.ashbi.ca` and `fleetflow.ashbi.ca`.
      Pick one canonical origin. `NEXTAUTH_URL`, email links, the CSP origin, and any OAuth or Stripe
      endpoints must all use it, and the other hostname should redirect to it.
- [ ] **Release mode.** Use `FLEETVERA_RELEASE_MODE=pilot` for the free beta. Stripe is not
      required in pilot mode, and `/billing` shows the free-beta notice while Stripe is unconfigured.
- [ ] **Gate.** Record which CI result approves the SHA: `Ashbi Local CI`, GitHub Actions
      (`quality` + `e2e`), or both.

## 1. Security prerequisites

- [ ] **Before rotating anything, decouple 2FA encryption.** `lib/cryptoSecrets.ts` encrypts TOTP
      2FA seeds with a key derived from `TOKEN_ENCRYPTION_KEY`, **falling back to `JWT_SECRET`**.
      If `TOKEN_ENCRYPTION_KEY` is unset in production today, first set `TOKEN_ENCRYPTION_KEY` to
      the **current** `JWT_SECRET` value, deploy, and confirm a 2FA login still works. Only then
      rotate `JWT_SECRET`. Rotating it first makes every enrolled user's 2FA seed undecryptable
      and locks them out.
- [ ] **#30:** generate a new `JWT_SECRET` (at least 32 random bytes) in the Coolify secret store
      and treat every previously committed value as burned. Rotating it logs out existing sessions.
      (If the old value was also used as `TOKEN_ENCRYPTION_KEY`, plan a separate re-encryption of
      2FA seeds to a fresh key; until then that key is only as secret as the leaked value.)
- [ ] Generate a fresh `CRON_SECRET` and `API_CURSOR_SECRET` (each at least 32 characters) and an
      `ACTION_PREVIEW_KEYS` ring. See `.env.example` for the format.
- [ ] Check that no production account still uses a legacy default password from the old setup
      notes (removed in #164). Login is by emailed code, but the accounts should still be reviewed.

## 2. Coolify environment

Set these in Coolify, never in git:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Private-network Postgres 16, least-privilege app role |
| `NEXTAUTH_URL` | Canonical `https://` origin with no path |
| `JWT_SECRET`, `API_CURSOR_SECRET`, `CRON_SECRET` | At least 32 characters each |
| `ACTION_PREVIEW_KEYS`, `ACTION_PREVIEW_CURRENT_KID` | A 1–3 key ring |
| `TOKEN_ENCRYPTION_KEY` | Encrypts 2FA seeds. Must be set explicitly, **never** left to fall back to `JWT_SECRET` (see §1) |
| `EMAIL_CONFIG_ENCRYPTION_KEY` | At least 32 characters. Mailgun credentials are entered later in `/admin/email-delivery` |
| `NEXT_PUBLIC_SENTRY_DSN` | Needed at **build** time (build arg) and at runtime |
| `FLEETVERA_RELEASE_MODE` | `pilot` |
| `TRUSTED_PROXY_HOPS` | `1` behind Traefik, so rate limits and audit IPs use the real client IP |
| `AI_PROVIDER`, `DOCUMENT_SCANNER_PROVIDER` | Leave `disabled` until #74 and #73 are complete |

- [ ] In the container, run `npm run verify:production-config`. It must report `ready: true`. It
      prints only the names of missing settings, never their values.

## 3. Database

`master` adds three migrations that run automatically on deploy (`prisma migrate deploy` in the
entrypoint):

- `20260925000000_auth_hardening`: adds `tokenVersion` and `lastTotpStep`, stores share tokens
  hashed, and **deletes existing task share links**. People must re-share any links still in use.
- `20260925010000_team_delete_restrict_password_history_fk`: blocks deleting a team that still owns
  records, and adds the `PasswordHistory` foreign key after removing orphaned rows.
- `20260925020000_maintenance_overdue_reminder`: adds `overdueReminderSentAt`, backfilled.

- [ ] Take a verified backup (`docs/runbooks/backup-restore.md`) and record its ID and timestamp.
- [ ] Rehearse all three migrations on a **restored copy** of production, then run
      `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code`
      against it (#72).

## 4. Networking

- [ ] DNS A/AAAA records for the canonical host point at the VPS. Let's Encrypt TLS is issued by
      Traefik and auto-renews.
- [ ] HSTS is on, and the non-canonical hostname redirects to the canonical one.
- [ ] Postgres is not reachable from the public internet.

## 5. Scheduled jobs

Every cron route accepts only `POST` with the `X-Cron-Secret: <CRON_SECRET>` header, sent over
HTTPS to the canonical origin. Schedule each one (a Coolify scheduled task or host cron calling
`curl -fsS -X POST -H "X-Cron-Secret: $CRON_SECRET" https://<host>/api/cron/<name>`):

| Route | Suggested schedule |
|---|---|
| `maintenance-reminders` | Daily, early morning in the fleets' time zone (e.g. 10:00 UTC) |
| `cleanup-audit-logs` | Daily |
| `ai-retention` | Daily |
| `document-retention` | Daily |
| `integration-retention` | Daily |
| `maintenance-risk-retention` | Daily |
| `pilot-retention` | Daily |

- [ ] Each job alerts on a non-2xx response (see `docs/runbooks/monitoring.md`).

## 6. Email

- [ ] Follow `docs/runbooks/transactional-email.md` (#70): Mailgun domain, SPF/DKIM/DMARC
      alignment, credentials saved in `/admin/email-delivery`, and delivery tested to two
      controlled mailboxes. Login codes depend on email, so **the beta cannot launch without this.**

## 7. Deploy

- [ ] Confirm the approved CI check is green on the exact `master` SHA.
- [ ] Run the **Deploy to Coolify** workflow with that full SHA (`docs/runbooks/deploy-and-rollback.md`).
- [ ] Watch the entrypoint logs: the preflight passes, then `migrate deploy` applies 3 migrations,
      then the app starts. The container health check allows a 60s start period.

## 8. Smoke test (synthetic accounts only)

- [ ] `GET /api/health` returns 200.
- [ ] Log in with an email code and complete 2FA. "Log out everywhere" signs out another browser.
- [ ] Switch workspaces. Create, edit and delete a vehicle, delivery, maintenance task and client.
      Deleting a vehicle that has expenses returns a clear 409.
- [ ] Driver account: sees only assigned deliveries. Viewer/technician: cannot create API keys.
- [ ] `/pricing` and `/billing` show the free beta. No checkout is offered.
- [ ] A Sentry test event arrives with release = SHA, and the health alert reaches its owner.
- [ ] 375px mobile check on the dashboard and the deliveries list.
- [ ] Optional: run the Playwright suite against the deployment with
      `PLAYWRIGHT_TEST_BASE_URL=https://<host> PLAYWRIGHT_ALLOW_PRODUCTION=1` and **synthetic
      accounts only**.

## 9. Rollback readiness

- [ ] Record the previous image digest. Rollback means redeploying that image. Migrations are
      never reversed automatically; follow `docs/runbooks/deploy-and-rollback.md`.
- [ ] Rehearse one rollback before inviting beta users.

## 10. Go / no-go

- [ ] Record the SHA, image digest, deploy time, backup ID, smoke-test results, and approver in #76.
- [ ] Invite the first beta workspaces (`docs/runbooks/controlled-pilot.md`).
