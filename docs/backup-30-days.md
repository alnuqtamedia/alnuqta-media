# Daily ZIP backup: 30-day retention

This replaces weekly/monthly emergency-backup retention proposals. Only the latest 30 days of emergency backups are retained. Nothing deletes live articles, editorial revisions or source images. Independent editorial preservation has a separate bucket and no automatic expiry.

Status (2026-10-05): database and Storage connections verified. First manual emergency export passed the 22-file ZIP integrity check, encryption, upload, 30-day Compliance retention and exact-version download checksum. Long-term preservation passed: 104 new encrypted objects and 10 existing objects verified in run 37301429414. Decryption and a managed-Supabase restore remain untested; scheduled backups stay disabled.

## Destination (separate Backblaze B2 account)

Create a PRIVATE bucket with Object Lock. Apply a lifecycle rule only to `alnuqta-backups/`:

```json
[{"fileNamePrefix":"alnuqta-backups/","daysFromUploadingToHiding":30,"daysFromHidingToDeleting":1,"daysFromStartingToCancelingUnfinishedLargeFiles":1}]
```

B2 lifecycle runs asynchronously. Files are hidden after 30 days and physically deleted after a further day/processing delay, once Compliance retention expires. Budget for roughly 31 daily copies, not an exact midnight deletion. This is the provider-supported lifecycle mechanism, not a GitHub deletion key. Verify the rule in the B2 console and test with disposable objects first. Do not use an empty prefix. GitHub's upload key must not allow deleteFiles, bucket settings changes or retention bypass. It needs write/read files and read retention to verify the exact uploaded version.

## GitHub configuration

Use the existing environment `Backblaze`, restrict it to the default branch, protect workflow/script changes through review. Enable notifications for workflow failures; independent stale-backup monitoring is still required because missed schedules do not generate failures.

Secrets: BACKUP_DATABASE_URL (direct or session-pooler Postgres URL, never transaction pooler), SOURCE_S3_ACCESS_KEY, SOURCE_S3_SECRET_KEY (Supabase Storage S3 credentials), B2_ACCESS_KEY, B2_SECRET_KEY. Use the GitHub environment secrets interface; never paste keys into chat or commit them.

Variables: BACKUP_AGE_RECIPIENT (public age recipient only), SOURCE_S3_ENDPOINT, SOURCE_S3_REGION, B2_ENDPOINT, B2_REGION, B2_BUCKET, B2_ARCHIVE_BUCKET. Manual workflow_dispatch runs on main are permitted while scheduling remains disabled. Only set repository BACKUP_ENABLED=true after recovery validation to enable scheduled runs; environment-level variables cannot activate a job-level if condition. Save the private age key separately/offline; it never goes into the backup runner. No public workflow artifacts contain the backup.

## Long-term editorial preservation

Create B2_ARCHIVE_BUCKET as a second PRIVATE Object-Lock bucket. It MUST be distinct from B2_BUCKET and MUST have NO automatic expiry rules. New encrypted records/media get a one-year Compliance lock; they remain stored after the lock expires (they are not automatically deleted). Annual protection renewal and an independently administered/offline second copy are still required for ongoing protection; no lifetime immutability claim is made.

The daily collector captures all articles, translations and existing revision rows, including private drafts, into encrypted content-addressed records; do not expose this bucket. Images are stored by content hash and their metadata is retained separately. Unchanged records/images are reused. There is no delete operation. A daily collector is not instant per-publication capture; existing database revision triggers preserve intermediate texts until export, but image versions deleted before a collector run cannot be recovered. Immediate media preservation is a remaining integration requirement.

Both buckets must be in scope of the upload/read-only B2 application key. The archive bucket needs listFiles/readFiles/writeFiles/readFileRetentions/writeFileRetentions; no deleteFiles or bucket administration.

The standard Ubuntu runner must have AWS CLI, Docker and Python 3.11+. The PostgreSQL 17.6 dump client supports servers up to version 17; use a compatible client for newer servers. Secrets authorize privileged exports and must be protected even though destination deletion is denied.

## Contents and validation

Custom-format PostgreSQL logical dump (includes schema/data/grants), password-free role definitions, Storage metadata, all standard S3-accessible Storage bucket bytes, SHA256 manifest. ZIP deflate level 9 and ZIP64, CRC verification, then age encryption. Each upload has a unique name and 30-day Compliance retention; download and compare SHA256 before marking success. Images already compressed may barely shrink. ZIP reduces destination storage; it does not reduce source download bandwidth.

Raw dump restoration into managed Supabase requires handling reserved roles/schemas/extensions; this archive is NOT proof of complete disaster recovery. Database and Storage exports are not an atomic snapshot: run during quiet hours and reconcile changes during the recovery rehearsal. It does not capture external image hosts, platform Auth settings, Edge secrets or domain configuration. Store/recover those separately through a restricted channel. Large archives beyond PutObject's single-upload limit need a multipart uploader before growth reaches that limit.

## Restore rehearsal before production approval

Decrypt with the offline age key; verify ZIP and every manifest hash. Restore the dump into an isolated compatible PostgreSQL/Supabase test environment, map managed roles safely, then re-upload Storage files through Storage API/S3. Verify articles, translations, revision history, image IDs/URLs, RLS, Owner/MFA access and manual publication. Measure recovery time. Never restore onto the live project for a test.

References:
- https://www.backblaze.com/docs/cloud-storage-lifecycle-rules
- https://www.backblaze.com/docs/cloud-storage-object-lock
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/storage/management/download-objects

## Offline integrity validation (2026-10-03 follow-up)

Run `python3 scripts/test-backup.py`. Eight tests cover ZIP roundtrip, repeated packaging, data corruption, missing media, real media inventory, unsafe paths, unlisted entries, symlinks and nested ZIP output (roundtrip/repackage share one test). These tests need no production credentials or network.

After decrypting an actual backup, run `python3 scripts/backup-verify.py backup.zip` BEFORE extracting or restoring. It verifies exact manifest inventory, required files, SHA256 and Storage sizes without extraction. Failure stops recovery. This verifies the archive bytes; it does not prove PostgreSQL or managed Supabase restoration. The daily runner invokes it before encryption.

The Backblaze setup completed with a bucket-scoped non-delete application key on 2026-10-05. Database read-only connection and source/destination Storage roundtrip checks passed. Public age recipient was configured; the private identity stays with the owner. Run 37301021770 exported and verified the emergency backup, then stopped during preservation retention comparison. Whole-second retention timestamps and verification of previously uploaded records were added; run 37301429414 completed successfully at 11:19 UTC (14:19 Baghdad), verifying 104 new preservation objects and reverifying 10 existing objects. Bootstrap B2 credentials and the temporary GitHub setup token still require cleanup after setup verification. No successful full restore or scheduled backup is claimed.

## Local private-key and decrypted-file verification (2026-10-05)

The owner received a self-contained `alnuqta-recovery-check.html` tool. Open the downloaded file locally in Chrome, select the private age identity file, and verify the embedded public challenge. The tool checks that the derived recipient equals the configured backup recipient, without transmitting the identity or storing it in browser storage. Select a private B2 `.zip.age` backup to decrypt, verify the ZIP inventory/SHA256 and Storage metadata, and decode supported image formats. Download only the non-content JSON report for review. Never upload the private identity or decrypted database to the public repository.

The tool bundles official `age-encryption@0.3.1` and `fflate@0.8.2`; CSP denies network connections. It supports up to 200 MiB of encrypted input and 512 MiB of decompressed payload; oversized files are rejected before decompression. Its SHA256 is `86ba2f0ef6e87bb5a1d1e64cf96d3ea8aebfe72c05ffc7fdbb4fea25bfbcce6d`.

Tests passed with synthetic identities: compatibility with the previous WebCrypto key generator, age encryption/decryption, wrong-key rejection, corrupt/missing/unsafe ZIP rejection, and the bundled application's key-check/decryption/reset flows. Cloud Browser disallows local-file URLs, so its visual browser preview was not performed. No real owner identity or existing encrypted backup was decrypted by the assistant. A successful local report is not proof of PostgreSQL or managed-Supabase restoration; that isolated recovery rehearsal remains required. Scheduling remains disabled.
