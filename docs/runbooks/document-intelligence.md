# Document intelligence operations

Fleetvera accepts PDF, JPEG, and PNG service invoices or inspection records up to 10 MB. PDFs are limited to 25 pages; images are limited to 12,000 pixels per dimension. Files are stored outside `public/`, with opaque HMAC-derived keys and private filesystem permissions. The authenticated source endpoint uses `private, no-store` and `nosniff` headers.

## Production requirements

Document intake intentionally fails closed in production until these external services are configured:

1. Mount durable encrypted private storage and set `DOCUMENT_STORAGE_PATH`. This path must not be below the application `public` directory and must be included in backup/restore policy.
2. Set a random, secret `DOCUMENT_STORAGE_SECRET` of at least 32 characters. Rotation requires re-keying stored objects.
3. Register a production `MalwareScanner` adapter in `lib/documents/storage.ts` (for example, a private ClamAV service). Do not expose the scanner publicly or permit user-controlled scanner endpoints. The checked-in production default rejects every upload. Object streams, xref streams, compressed streams, encrypted PDFs, and active-content PDFs fail closed. A complex/compressed PDF is accepted only when the registered adapter explicitly returns `authoritativeDocumentSafety: true`; set that capability only when the adapter authoritatively parses/decompresses within bounded memory, validates the complete object graph, enforces the 25-page limit, and returns a clean verdict.
4. Register a `DocumentExtractor` for `DOCUMENT_AI_PROVIDER`. It must return strict structured output plus OCR text by page so citations can be verified. The checked-in `disabled` provider creates an empty, manually editable draft and makes no network call.
5. Set `ACTION_PREVIEW_SECRET` (or `NEXTAUTH_SECRET`) to at least 32 random characters.

## Retention and deletion

Uploads expire after 30 days. Schedule a daily authenticated `POST /api/cron/document-retention` with a 32-character-or-longer `CRON_SECRET`. Upload reservation, user deletion, and retention share a PostgreSQL advisory lock by workspace. Deletion first records a durable `DELETING` ownership token and revision, rechecks the token, storage key, expiry and revision, removes the object, and then finalizes the row with a CAS. Extraction uses a renewable token and discards success or failure after deletion, expiry, or ownership loss. Object deletion must succeed before the database row is marked deleted. Monitor `DELETING` rows and rows past `expiresAt`; they indicate storage or cleanup failure and are safe for an operations-controlled retry using the same claim protocol.

Uploader and confirmer IDs use `ON DELETE SET NULL`, while immutable actor snapshots preserve who performed the action after account deletion. Never rewrite those snapshots during ordinary document edits.

## Smoke test

Use a disposable workspace. Upload one clean PDF, one JPEG, and one PNG; confirm the authenticated source preview, manual draft save, low-confidence warning, signed preview, cancellation with no new record, one confirmed expense, and duplicate retry. Confirm a foreign workspace receives 404. Delete the uploads and verify the underlying objects are gone.

Test the scanner with its standard harmless antivirus test fixture in a non-production environment. Never place a real malicious sample in the application volume. Verify malformed, encrypted, oversized, and MIME-mismatched files are rejected before storage.

## Rollback

Disable the Documents navigation entry and reject uploads. Keep the private volume mounted while rolling back the application so retained rows can still be deleted. Do not drop document tables or delete the volume during application rollback. Restore the prior application image, then verify ordinary maintenance and expense records remain intact.
