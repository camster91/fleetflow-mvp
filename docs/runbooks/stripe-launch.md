# Stripe launch runbook

## Safety rule

Do not create live charges or enable live checkout until every sandbox scenario below has passed and its evidence has been retained. Never paste Stripe secrets, signatures, customer data, or raw provider errors into tickets or client-visible logs.

## Configuration

Set these server-only environment variables in each environment:

- `STRIPE_SECRET_KEY`: restricted test key during validation; live restricted key only at approved launch.
- `STRIPE_WEBHOOK_SECRET`: signing secret for that environment's webhook endpoint.
- `STRIPE_PRICE_MONTHLY`: exact recurring monthly Price ID for Fleetvera Pro.
- `STRIPE_PRICE_YEARLY`: exact recurring yearly Price ID for Fleetvera Pro.
- `STRIPE_PRICE_MONTHLY_AMOUNT`: audited monthly Price amount in Stripe minor units, such as `4900` for CAD 49.00.
- `STRIPE_PRICE_YEARLY_AMOUNT`: audited yearly Price amount in Stripe minor units.
- `STRIPE_PRICE_CURRENCY`: uppercase ISO currency configured on both Prices, from the supported launch currency list.
- `NEXTAUTH_URL` (or `APP_URL`): canonical HTTPS application origin used for checkout redirects. Billing remains disabled for HTTP, malformed, or missing origins and never derives redirects from the request `Host` header.

Verify both Price IDs, amounts, and currency together against the Stripe Dashboard during every configuration change. Restart the service, request `GET /api/stripe/availability`, and confirm it returns `available: true` plus the reviewed monthly/yearly minor-unit prices and currency. The response intentionally never identifies missing variable names or returns secret values. Confirm the UI displays those returned prices and calculated savings, and checkout controls are disabled with a clear message when any required value is missing or invalid.

## Webhook setup

Create one Stripe endpoint for `https://<host>/api/stripe/webhook` and subscribe to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Copy that endpoint's signing secret to `STRIPE_WEBHOOK_SECRET`. Signature validation requires the untouched raw request body. A processing failure must return HTTP 500 so Stripe retries; invalid signatures return 400. Successfully processed event IDs are stored in `StripeWebhookEvent`, making repeated delivery a no-op.

For local sandbox work, use `stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the printed temporary signing secret only in the local environment. Stripe CLI triggers are useful for smoke checks; use a real sandbox subscription and a Stripe test clock when verifying renewal and cancellation timing.

## Required sandbox evidence

Record the event ID, application result, database result, and screenshot where relevant. Do not record credentials or full payment/customer details.

1. Monthly purchase: use a Stripe test card, return successfully, and verify the owner-scoped subscription is active with the configured monthly Price ID.
2. Yearly purchase: repeat and verify the configured yearly Price ID. An unrecognized Price ID must fail processing and must never be silently mapped to a plan.
3. Renewal: advance a test clock and verify an `invoice.paid` or `invoice.payment_succeeded` event records one paid invoice and keeps the subscription active.
4. Duplicate delivery: resend the same event ID at least twice. Verify one state transition, one invoice, and HTTP 200 with the duplicate response on repeats.
5. Failed payment: use Stripe's decline/failure test method, verify the invoice is recorded as failed, the subscription becomes past due, and the UI communicates that state.
6. Invoice view: as the owner/admin, verify `/billing/invoices` shows amount, currency, period, status, and a working Stripe-hosted PDF link. Verify a viewer cannot access another tenant's invoices.
7. Cancellation: cancel at period end, verify the pending-cancellation message and date, advance the clock, then verify the deleted event produces `CANCELLED` and an audit entry.
8. Refund: issue a sandbox refund and verify the Stripe Dashboard result. Fleetvera currently does not model refund status; support must use Stripe as the authoritative refund record until refund events are implemented.
9. Retry: temporarily make database processing fail, verify HTTP 500, restore it, resend the same event, and verify it completes once.
10. Cleanup: cancel sandbox subscriptions, remove test customers if policy allows, restore test-clock state, and delete disposable local records only through an approved, tenant-bounded cleanup procedure.

## Plan enforcement

Enforcement lives in `lib/entitlements.ts`. It is active only when `FLEETVERA_RELEASE_MODE=public` **and** checkout is configured (`/api/stripe/availability` reports `available`). In pilot mode, or whenever any Stripe setting is missing, every workspace keeps full access. A workspace can never be locked out while nobody can pay.

| Situation | Access |
|---|---|
| No paid subscription | Full access for 14 days from the owner's sign-up, or until `FLEETVERA_BETA_ENDS_AT` if that is later; read-only after |
| `ACTIVE` | Full access (pending cancellation: until the end of the paid period) |
| `PAST_DUE` | Full access for 7 days from the first failed payment (`Subscription.pastDueSince`), read-only after |
| `UNPAID` (Stripe stopped retrying) | Read-only |
| `CANCELLED` | Full access until `currentPeriodEnd`, read-only after |

- **Read-only:** reads, exports, billing, settings, team management, disconnecting an integration, asking the assistant questions, and sign-in keep working. Assistant actions, integration connect/sync/review and shared task links are blocked, since they change data. Other writes return `402` with code `SUBSCRIPTION_REQUIRED` and a message saying the data can still be viewed and exported. Drivers can still update the status of deliveries assigned to them. The public `/api/v1` is read-only by design, so it is unaffected.
- **Scope:** team members inherit the workspace owner's subscription.
- **Banner:** the dashboard shows the state to every member via `/api/subscription/entitlement`: trial countdown in the last 14 days, payment-failed deadline, pending cancellation, or read-only. Only owners and admins see the billing link.
- **Before switching to public mode:** announce the paid launch and set `FLEETVERA_BETA_ENDS_AT` (ISO 8601) at least 30 days out. If it is unset, every workspace older than 14 days becomes read-only immediately; the readiness check warns about this.

Additional sandbox evidence for enforcement:

1. With a test clock, let a new workspace pass 14 days: the banner turns read-only, `POST /api/vehicles` returns 402, and exports still download. Subscribe: writes work again as soon as the webhook records the subscription.
2. Fail a renewal: the banner shows the payment-failed deadline and writes still work. Advance 7 days: read-only. Pay the invoice: full access returns and `pastDueSince` is cleared.
3. Cancel at period end, advance past `currentPeriodEnd`: read-only.

## Launch and rollback

Before launch, confirm the database migration containing `StripeWebhookEvent` is applied, backups and restore instructions are current, webhook delivery health is green, and the deployed Price IDs exactly match the approved live products. Repeat the purchase, invoice, failure, cancellation, authorization, and duplicate-delivery checks in live mode only with an approved low-value internal transaction.

If billing synchronization is unhealthy, remove or unset one Stripe configuration value and restart to disable checkout. This also suspends plan enforcement, so every workspace keeps (or regains) full access until billing is healthy again. Preserve webhook delivery history for replay. Roll back the application to the last known-good image only after confirming its schema compatibility; do not drop `StripeWebhookEvent` during rollback. After recovery, replay failed Stripe events and reconcile subscriptions and invoices against the Stripe Dashboard before re-enabling checkout.
