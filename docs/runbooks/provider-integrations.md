# Provider integrations runbook

## Product validation gate

The roadmap's five-operator interviews have not been completed or represented as completed in this implementation. Google Maps followed by QuickBooks Online is the roadmap recommendation, not a validated customer ranking. Before broad rollout, interview at least five target fleet operators, record their manual-work pain points and integration choices, and revisit this order from evidence.

## Supported behavior

- Google Maps uses a server-only API key. It geocodes at most 25 delivery addresses per run through the fixed `https://maps.googleapis.com` host, only fills a missing `dropoffLocation`, and records per-delivery provenance. It does not provide live GPS or silently replace saved coordinates.
- QuickBooks Online uses Intuit's documented confidential-client authorization-code OAuth flow with a single-use, ten-minute state. Intuit's current QuickBooks Online flow does not document PKCE parameters, so Fleetvera does not send unsupported `code_challenge` fields. Sync stages up to 25 purchase records as `PENDING_REVIEW`; it never creates or overwrites an expense until an operator maps the record to a vehicle and confirms it.
- Only the selected workspace's owner or admin can connect, sync, reconnect, or disconnect. Cookie-authenticated mutations require same-origin requests.

## Configuration

Set `INTEGRATION_ENCRYPTION_KEYS` to comma-separated `key-id:base64-key` entries. Each decoded key must be exactly 32 bytes; the first key encrypts new credentials and retained keys decrypt older envelopes. Rotate by prepending a new key, deploy, reconnect or re-encrypt stored connections, then remove the retired key only after no envelope references it.

Set and restrict `GOOGLE_MAPS_SERVER_API_KEY` in Google Cloud to the Geocoding API only, the production server egress addresses where supported, and an intentionally low daily/request quota. Do not configure a browser key. `GOOGLE_MAPS_BASE_URL` must remain `https://maps.googleapis.com`. Route calculation is not enabled because the current delivery records do not provide a trustworthy route origin and stop sequence.

Configure a QuickBooks production application and set `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, and the exact HTTPS `QUICKBOOKS_REDIRECT_URI`. Set `QUICKBOOKS_API_BASE_URL` to `https://quickbooks.api.intuit.com` for production or the explicitly allowed `https://sandbox-quickbooks.api.intuit.com` for sandbox QA. Request only `com.intuit.quickbooks.accounting`. Keep the client secret and integration keyring out of client bundles, logs, support screenshots, and backups without encryption.

## Operations and incidents

Sync requests require a unique `Idempotency-Key`. A durable job marker prevents duplicate execution. A 30-second owner-token lease is renewed and generation-fenced before every database side effect; expired leases and stale `RUNNING` jobs are safely reclaimed, while an old worker cannot complete or write after disconnect or lease loss. Runs use bounded batches, response-size limits, timeouts, capped exponential retries, deterministic cursors, and a one-hour next-sync marker. Google records retain per-record applied, retry, dead-letter, and conflict outcomes; a wholly failed batch is not reported as successful, and partial failures remain visible with a safe stable error code.

## Integration data retention

Invoke `POST /api/cron/integration-retention` with the deployment-wide `X-Cron-Secret`; this endpoint is deliberately tenant-independent and accepts no user session as authorization. Run it daily. It removes fixed rate-limit buckets after 2 days, expired or day-old OAuth state after 1 day, terminal sync jobs after 90 days, and staged provider payloads plus their cascading review decisions after 365 days. Active connections, credentials, active jobs, delivery coordinates, expenses, and audit logs are not removed by this job. Keep the general audit-log cleanup schedule separate.

If refresh credentials expire, the connection becomes `RECONNECT_REQUIRED`. Disconnect attempts provider revocation, then always removes local credentials and active OAuth states; `REVOCATION_UNCONFIRMED` means an administrator must verify revocation in the provider console. Imported provenance records remain as an audit trail.

During an incident: disable the connection, revoke credentials in the provider console, rotate the affected integration encryption key if exposure is possible, preserve job/error metadata, and never copy token responses into tickets. Provider response bodies and customer identifiers are intentionally absent from application errors.

## Release verification

1. Apply the additive Prisma migration in staging and run a fresh-database bootstrap plus upgrade/no-diff check.
2. Verify owner/admin access, member denial, selected-workspace isolation, same-origin rejection, expired/tampered/replayed callback state, and disconnect cleanup.
3. Exercise duplicate sync keys, concurrent sync requests, a partial 25-record page, a rotated QuickBooks refresh token, provider 429/5xx retry, an oversized response, and missing-coordinate-only Google updates.
4. In a disposable staging tenant, complete both consent/configuration paths using non-customer test accounts. Confirm the UI shows last sync, next sync, safe errors, reconnect, and disconnect at desktop and 375px.
5. Do not advertise live GPS, automatic bookkeeping, or operator-validated prioritization based on these integrations.
