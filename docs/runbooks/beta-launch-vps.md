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
- [ ] **Gate.** `.github/workflows/deploy-coolify.yml` only deploys a SHA with a successful
      `Ashbi Local CI` check, so that check must be green. Also require the GitHub Actions
      `quality` and `e2e` jobs if they are enabled. They add coverage but do not replace
      `Ashbi Local CI` unless the deploy workflow is changed.

## 1. Security prerequisites

- [ ] **Before rotating anything, decouple 2FA encryption.** `lib/cryptoSecrets.ts` encrypts TOTP
      2FA seeds with a key derived from `TOKEN_ENCRYPTION_KEY`, **falling back to `JWT_SECRET`**.
      If `TOKEN_ENCRYPTION_KEY` is unset in production today, first set `TOKEN_ENCRYPTION_KEY` to
      the **current** `JWT_SECRET` value (exactly, byte for byte), deploy, and confirm a 2FA login
      still works. The production preflight now refuses to start without `TOKEN_ENCRYPTION_KEY`. Only then
      rotate `JWT_SECRET`. Rotating it first makes every enrolled user's 2FA seed undecryptable
      and locks them out.
- [ ] **#30:** generate a new `JWT_SECRET` (at least 32 random bytes) in the Coolify secret store
      and treat every previously committed value as burned. Rotating it logs out existing sessions.
      (If the old value is now serving as `TOKEN_ENCRYPTION_KEY`, move it to
      `TOKEN_ENCRYPTION_KEY_PREVIOUS`, set a fresh `TOKEN_ENCRYPTION_KEY`, deploy, then run
      `docker exec <app-container> node reencrypt-2fa-seeds.cjs` (dry run) and again with
      `--apply`. Remove `TOKEN_ENCRYPTION_KEY_PREVIOUS` once it reports `failed: 0` and
      `reencrypted: 0` on a second dry run.)
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

- [ ] In the app container, run `node verify-production-readiness.cjs` (the entrypoint also runs it). It must report `ready: true`. It
      prints only the names of missing settings, never their values.

## 3. Database

`master` adds five migrations that run automatically on deploy (`prisma migrate deploy` in the
entrypoint):

- `20260925000000_auth_hardening`: adds `tokenVersion` and `lastTotpStep`, stores share tokens
  hashed, and **deletes existing task share links**. People must re-share any links still in use.
- `20260925010000_team_delete_restrict_password_history_fk`: blocks deleting a team that still owns
  records, and adds the `PasswordHistory` foreign key after removing orphaned rows.
- `20260925020000_maintenance_overdue_reminder`: adds `overdueReminderSentAt`, backfilled.
- `20260925030000_idempotency_keys`: adds the `IdempotencyKey` table (24h replay records for
  create requests, cleaned up by `cleanup-audit-logs`).
- `20260925040000_workspace_time_zone`: adds `timeZone` to teams and users, defaulting to
  `America/Toronto`. Owners and admins can change it under Settings › Company.

- [ ] Take a verified backup (`docs/runbooks/backup-restore.md`) and record its ID and timestamp.
- [ ] Rehearse the migrations on a **restored copy** of production (#72):
      1. Point `DATABASE_URL` at the restored copy and run `npx prisma migrate deploy`.
      2. Confirm the migrated copy matches the schema exactly:
         `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code`
         (exit code 0 means no difference).
      3. Optionally, repeat CI's repository drift check. It needs an empty scratch database as shadow:
         `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code`.

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
| `document-retention` | Only once document storage is configured (#73). In production it returns 503 while `DOCUMENT_STORAGE_PATH` is unset, so leave it unscheduled during the beta. |
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
- [ ] Watch the entrypoint logs: the preflight passes, then `migrate deploy` applies the pending migrations,
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
