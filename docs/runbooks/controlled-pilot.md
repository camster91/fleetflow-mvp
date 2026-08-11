# Controlled pilot runbook

Use this runbook only after the deployment, backup, provider, and configuration gates in the release-readiness report are satisfied. It does not authorize a production deployment.

## Cohort and defaults

Begin with up to five fleets and roughly 20–30 operators. Keep AI, document extraction, and provider integrations disabled unless their individual production preflight and provider validation have passed. The named support owner records structured, content-free incidents; customer prompts, uploaded document contents, and operational payloads do not belong in pilot telemetry.

## Enrollment

An owner or admin records consent and activates a workspace through `PUT /api/admin/pilot/enrollment`. The API audit log records the status change without consent text. Set a planned start and end date, name the support owner, and confirm `GET /api/admin/pilot/metrics` reports the expected status before inviting users.

## Signals and retention

The dashboard records at most one `DASHBOARD_OPENED` and one `FIRST_USEFUL_ACTION` signal per user/session/event type. Signals contain only opaque session IDs, actor IDs, timestamps, and event type. Structured pilot incidents store severity/category/status only. Both expire after 365 days. Schedule `POST /api/cron/pilot-retention` with `X-Cron-Secret` using the existing CRON_SECRET rotation policy.

## Weekly review and exit

Review active-operator adoption, first useful actions, time-to-first-action, structured incident counts, and the existing AI/data-quality audit views weekly. Pilot exit requires four complete weeks, at least 70% weekly active operators, no critical incident, and repeated uncoached action from the Intelligence Brief. Capture qualitative interviews and commercial decisions outside application telemetry under the approved customer research process.

## Incident ownership

The user-designated support/incident owner owns customer communication, severity triage, and production rollback decisions. Record only category and severity in the product. Escalate any suspected security incident using `docs/runbooks/incident-response.md`.
