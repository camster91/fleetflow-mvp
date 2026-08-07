# Incident response

1. Triage severity and establish an incident owner and timeline.
2. Contain exposure: disable the affected integration or deployment, revoke compromised credentials, or stop writes. Preserve evidence before cleanup.
3. Assess affected tenants, records, billing events, and time window using application, provider, and audit logs.
4. Recover from a known-good image and verified data backup, then repeat security and tenant-isolation checks.
5. Notify affected parties according to approved legal, privacy, contractual, and regulatory requirements.
6. Rotate secrets, correct the root cause, add a regression test, and document follow-up owners and deadlines.

Never copy secrets, session tokens, full database URLs, payment data, or personal data into tickets or chat. Cross-tenant access, credential compromise, data loss, and incorrect charging are critical incidents.
