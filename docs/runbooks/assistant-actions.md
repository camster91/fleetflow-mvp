# Assistant suggested actions

Suggested actions never mutate records at preview time. A manager or admin must review the exact before/after snapshot and separately confirm a write within five minutes.

Set `ACTION_PREVIEW_KEYS` to a JSON object containing one to three unique dedicated random secrets of at least 32 bytes each (`openssl rand -base64 48`), and set `ACTION_PREVIEW_CURRENT_KID` to the issuing key. Do not reuse authentication secrets. Tokens fail closed for malformed rings, missing/weak/duplicate keys, unknown current IDs, future issuance, expiry, or lifetimes over five minutes. To rotate, add the new key, select it as current, deploy, wait over five minutes, then remove the previous key.

`ActionExecution` is an immutable security receipt. Its owner, team, proposer, confirmer, and source-finding IDs are snapshots rather than cascading foreign keys so later account/team/finding deletion cannot erase history. Retain these receipts and matching `AuditLog` entries under the organization audit-retention policy; deletion workflows must anonymize identifiers only when legally required and must not silently cascade them.
