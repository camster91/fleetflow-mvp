# AI incident response

This runbook covers Fleetvera AI synthesis. Fleet tools remain deterministic and read-only when AI is disabled.

## Immediate containment

1. Set `AI_KILL_SWITCH=true` in the deployment environment and restart the application. This global switch overrides every workspace and prevents provider calls.
2. For a single workspace, open **Admin → AI health**, enable the emergency workspace kill switch, and save. Only the workspace owner or an accepted workspace admin can change it.
3. Confirm the health page reports **Killed** or **Disabled**. Ask a supported assistant question and confirm the response is `deterministic` with cited Fleetvera records.
4. Do not copy prompts, user identifiers, API keys, or record content into the incident ticket. Record timestamps, provider/model version, config version, aggregate status/error code, and deployment revision only.

## Triage

- Citation or unsupported-claim concern: keep AI killed, preserve the deterministic tool result, and run `npm run ai:evaluate`.
- Suspected tenant disclosure: treat as severity 1. Keep the global switch on, preserve database audit/aggregate rows, and rotate provider credentials if exposure is plausible.
- Provider outage, latency, or cost spike: use the 24-hour health aggregates. Verify configured provider/model against deployment environment; pricing is versioned in `lib/ai/pricing.json` and must be reviewed when a model changes.
- Telemetry rows contain only hourly scope aggregates. Raw prompts, answers, record IDs, user IDs, request IDs, and PII must never be persisted.

## Release gate and recovery

`npm run ai:evaluate` is offline and makes no provider call. A release is blocked when any tenant-isolation case fails, any unsupported claim exists, citation accuracy is below 95%, or provider-quality generated coverage is below 100% of supported cases. Missing-data and tenant-isolation cases require an explicit provider fallback, while adversarial cases require an explicit refusal. Each fixture has a $0.01 USD cost ceiling using the configured provider/model price, never a model claimed by an output. Re-enable one test workspace only after the evaluation passes, automated tests pass, and the provider/model configuration is reviewed. Observe health aggregates before wider re-enablement.

## Retention

Workspace telemetry retention is 30 days by default and bounded to 7–90 days. Schedule a daily authenticated `POST /api/cron/ai-retention` with the deployment `x-cron-secret`; it deletes only hourly buckets older than each exact workspace cutoff. Control audit records are metadata-only and retained for incident accountability.
