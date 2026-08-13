# Transactional email runbook

Fleetvera uses one Mailgun adapter in `lib/email.ts` for login codes, team invitations, and operational messages. Never use a real recipient while developing or running automated tests.

## Production configuration

Configure the application encryption key in the deployment platform, then save the Mailgun sending configuration in the authenticated application settings screen.

1. Set `EMAIL_CONFIG_ENCRYPTION_KEY` to a unique high-entropy secret of at least 32 characters. It encrypts the Mailgun API key at rest and must be preserved through application-image rollbacks.
2. Sign in as a **platform administrator** and open `/admin/email-delivery`.
3. Enter the restricted Mailgun sending key, exact sending domain, verified domain, and From address. The key is never returned by the API or displayed after saving.

The legacy server-side variables below remain a break-glass compatibility path for an existing deployment, but should not be added to browser-visible configuration or used for routine changes:

- `MAILGUN_API_KEY`: restricted Mailgun sending key.
- `MAILGUN_DOMAIN`: the exact sending domain used by the Mailgun API.
- `MAILGUN_VERIFIED_DOMAIN`: operator acknowledgement that the exact `MAILGUN_DOMAIN` has passed Mailgun DNS verification and the controlled smoke test below. This is evidence-backed configuration, not a provider lookup performed by the app.
- `MAILGUN_BASE_URL`: use Mailgun's regional API URL when applicable; otherwise omit it.
- `FROM_EMAIL`: a valid mailbox or display-name address on the exact configured sending domain, such as `Fleetvera <notifications@mg.example.com>` when `MAILGUN_DOMAIN=mg.example.com`.
- `NEXTAUTH_URL` (preferred) or `NEXT_PUBLIC_APP_URL`: the canonical HTTPS application URL used in email links.
- `EMAIL_DELIVERY_TIMEOUT_MS`: optional bounded provider wait; defaults to 4000 ms.
- `LOGIN_RESPONSE_TARGET_MS`: optional common response target; defaults to 4500 ms and is forced to remain at least 100 ms longer than the delivery timeout.

Do not expose the API key through a `NEXT_PUBLIC_` variable. Production sends fail visibly when readiness validation reports missing or inconsistent settings; test and development builds continue to use the local no-send behavior. A workspace owner or workspace administrator cannot alter the deployment-wide transport credential.

## DNS and provider setup

1. Add the domain in Mailgun and select the correct sending region.
2. Add the provider-supplied SPF TXT, DKIM TXT/CNAME, tracking CNAME, and receiving MX records if inbound handling is required.
3. Ensure the domain has only one effective SPF policy; merge includes instead of publishing competing SPF records.
4. Wait for Mailgun to mark every required sending record verified.
5. Save that exact verified domain in `/admin/email-delivery` (or, only for the legacy compatibility path, set `MAILGUN_DOMAIN` and `MAILGUN_VERIFIED_DOMAIN`).
6. Configure DMARC with reporting, then tighten its policy only after legitimate delivery is confirmed.

## Controlled smoke test

Use a dedicated, approved smoke-test inbox owned by the operator. Do not use a customer address.

1. Confirm the deployment health check is green.
2. Request one login code for a pre-created smoke-test user.
3. Confirm the API returns the generic anti-enumeration message after its bounded minimum-duration guard. It must never reveal whether the account exists, is locked, or whether delivery succeeded.
4. Confirm the message arrives, the sender and links are correct, and the code expires after ten minutes.
5. Create one disposable team invitation to the same controlled inbox and confirm the invitation URL opens the intended environment.
6. Check Mailgun events for `accepted` and `delivered`, not merely `queued`.
7. Check application logs for `auth.login_code.delivery_failed`. Failures include only a sanitized error category and a correlation ID. The same ID is sent to Mailgun as the `correlation-id` custom variable, allowing provider-event matching without logging the recipient, subject, body, provider response, or login code.

The login endpoint awaits Mailgun only within `EMAIL_DELIVERY_TIMEOUT_MS`; all known, unknown, locked, successful, failed, and timed-out account paths share `LOGIN_RESPONSE_TARGET_MS`. A provider operation that exceeds its window is safely observed in the background to prevent unhandled rejection, while the request records `delivery_timeout` and finishes on the common response schedule. Alert on any `delivery_timeout`, and investigate sustained occurrences as provider or network degradation. Do not increase either value to hide delivery problems; keep the response target above the provider timeout.

## Production delivery verification

Verify at least one message in each supported mailbox family used by the pilot (for example, a corporate mailbox plus Gmail or Outlook). Check inbox placement, SPF, DKIM, and DMARC alignment from received-message headers. Record the timestamp, recipient class, application correlation ID if present, provider event, and outcome in the private launch checklist. Set `MAILGUN_VERIFIED_DOMAIN` only after this evidence exists. Never copy addresses, login codes, raw provider responses, or API keys into tickets.

## Cleanup

- Delete the disposable invitation and smoke-test verification tokens.
- Remove the smoke-test user if it is not the retained monitoring account.
- Delete screenshots or logs containing addresses, links, or one-time codes.
- Keep only redacted delivery evidence and aggregate results.

## Rollback

If delivery regresses, restore the previously working application image and environment-variable revision. Do not bypass readiness checks or switch to a personal sender. Pause invitation campaigns, keep the generic login response in place, and use correlation IDs plus Mailgun events to diagnose the failure. Rotate the Mailgun key immediately if exposure is suspected, then repeat the controlled smoke test before resuming production traffic.
