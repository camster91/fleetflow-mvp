# Monitoring and alerting

Monitoring is a release gate for both controlled-pilot and public deployments. A configured SDK without a tested alert destination is not sufficient evidence.

## Configure the candidate

1. Create or select the production Sentry project and copy its public HTTPS DSN.
2. Supply the DSN as the Docker build argument `NEXT_PUBLIC_SENTRY_DSN`. The browser SDK and its Content Security Policy allowlist are generated at build time.
3. Supply the same `NEXT_PUBLIC_SENTRY_DSN` value to the running container. Changing the value requires rebuilding the image.
4. Keep `SENTRY_AUTH_TOKEN`, when source-map upload is enabled, in the build secret store. Never commit or bake that token into the final image.
5. Run `FLEETVERA_RELEASE_MODE=pilot npm run verify:production-config` in the exact runtime environment. The preflight must pass without printing configuration values.

## Establish the external checks

- Monitor unauthenticated `GET /api/health` over the production HTTPS origin. Require a 200 response containing only `{"status":"ok"}` and record the check owner.
- Configure an alert for sustained server errors and a separate alert for health-check failures.
- Send alerts to the approved on-call destination and record the named responder, escalation path, and quiet-hours policy.
- Set retention and data-scrubbing rules before inviting pilot users. Do not send authentication cookies, authorization headers, document contents, customer payloads, or secrets as event context.

## Verify the exact deployment

After deployment, generate one controlled client error and one controlled server error using the provider's approved test procedure. Do not add an unauthenticated error-generation route to the application.

Record:

- candidate commit and immutable image digest
- deployment ID and UTC timestamp
- Sentry project/environment
- client and server event IDs
- alert rule and delivered notification evidence
- health-check ID, interval, region, and owner
- acknowledgement time and responding operator

Remove or disable any temporary test-only mechanism immediately after verification. Monitoring is not cleared until both events arrive, the alert reaches its destination, and the responder acknowledges it.
