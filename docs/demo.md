# Shareable Fleetvera demo

This demo showcases the full original Next.js application. The separate `replacement/` implementation and its production database are not changed.

## Experience

- `/demo` opens with one **Explore the demo** button; no email or password.
- Every visitor receives a private sample team, six vehicles, six clients, twenty-four deliveries, six maintenance tasks, four fictional teammates, procedure categories, two vending machines, a service-document extraction, one expense and sample billing records.
- Owner, dispatcher, driver and mechanic roles can be switched within the same sample team.
- Visitors can edit and delete sample operational records. Reset creates a new private workspace and invalidates the old session.
- Sessions expire after four hours. Cleanup removes up to five expired workspaces whenever a new demo is created. The landing page explains this retention behavior.
- Ask Fleetvera uses its existing deterministic, source-cited answers against sample records; no paid AI provider is connected.
- Real payments, invitations, uploads/scanning, provider connections, API keys, platform administration and unreviewed endpoints are protected with explanatory errors. Billing records and extracted documents are labeled samples; the demo does not pretend those external actions have executed.

## Isolation and bounds

`FLEETVERA_DEMO_MODE=true` is opt-in and startup refuses any database name other than `fleetvera_demo`. Only `pilot` release mode is allowed. The image preflight runs before migrations and rejects real email, Stripe, AI, integration, operations-alert and Sentry configuration.

Demo authentication uses the existing signed, HttpOnly cookie with a demo session identity. Each API authentication checks live expiry and that the user belongs to that demo. Demo tokens are rejected by a normal deployment. Tenant resolution also verifies the owner and active team match the session. The normal login system is unchanged when demo mode is off.

API routes use a deny-by-default demo allowlist. Normal owner/role authorization and same-origin checks still apply. Creation is serialized with a PostgreSQL transaction lock, capped at six new workspaces per IP per hour, 100 total creations per hour and 100 active sessions. Durable counters retain the global creation limit after resets. Authenticated requests use the existing 100-per-minute durable quota. Operational categories stop accepting changes at 100 records and offer reset. Proxy traffic is rate limited. Application and database containers have memory/CPU limits; PostgreSQL has no published port.

## Deployment plan

Use `docker-compose.demo.yml` as a NEW Compose project, `fleetvera-demo`. It creates a new app, PostgreSQL container, private network and `demo_database` volume. The app joins the already-existing `coolify` network solely for routing through the existing HTTPS proxy. It adds its own Docker-label router; shared proxy configuration and current app routes are not edited.

Proposed hostname: `fleetvera-demo.187.77.26.99.sslip.io` (A record verified to `187.77.26.99`). The exposed Traefik configuration already defines the `https` entrypoint and `letsencrypt` HTTP-challenge resolver. Certificate issuance and public HTTPS still require runtime verification.

Generate independent demo secrets on the server; do not reuse production database URLs or signing/encryption keys. Store the new project's environment in a mode-0600 file, never in Git, artifacts or logs. Required Compose variables are `DEMO_HOST`, `DEMO_REVISION`, `DEMO_DATABASE_PASSWORD`, `DEMO_JWT_SECRET`, `DEMO_CURSOR_SECRET`, `DEMO_EMAIL_SECRET`, `DEMO_TOKEN_SECRET`, `DEMO_ACTION_KEYS`. `DEMO_ACTION_KEYS` is a JSON object containing a `demo-v1` key of at least 32 characters.

Run the new project privately first, apply migrations only to its new database, and verify provisioning, independent visitor scopes, role permissions, reset, expiry, cleanup, source-cited assistant answers, document display and protected endpoints. Then publish its Docker-label HTTPS router and verify the actual public URL, cookie security and main mobile/desktop workflows. Do not call it live or ready until those checks pass.

Rollback stops only the `fleetvera-demo` project while retaining its volume and source revision. Never use a volume-deleting command on the existing application or shared services.
