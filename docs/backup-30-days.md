# Daily ZIP backup: 30-day retention

This replaces weekly/monthly emergency-backup retention proposals. Only the latest 30 days of emergency backups are retained. Nothing deletes live articles, editorial revisions or source images. Independent editorial preservation has a separate bucket and no automatic expiry.

Status: implementation prepared; destination, secrets, lifecycle policy, actual exports and full restore must be configured/tested before enabling. BACKUP_ENABLED defaults to disabled.

## Destination (separate Backblaze B2 account)

Create a PRIVATE bucket with Object Lock. Apply a lifecycle rule only to `alnuqta-backups/`:

```json
[{"fileNamePrefix":"alnuqta-backups/","daysFromUploadingToHiding":30,"daysFromHidingToDeleting":1,"daysFromStartingToCancelingUnfinishedLargeFiles":1}]
```

B2 lifecycle runs asynchronously. Files are hidden after 30 days and physically deleted after a further day/processing delay, once Compliance retention expires. Budget for roughly 31 daily copies, not an exact midnight deletion. This is the provider-supported lifecycle mechanism, not a GitHub deletion key. Verify the rule in the B2 console and test with disposable objects first. Do not use an empty prefix. GitHub's upload key must not allow deleteFiles, bucket settings changes or retention bypass. It needs write/read files and read retention to verify the exact uploaded version.

## GitHub configuration

Create environment `backup`, restrict it to the default branch, protect workflow/script changes through review. Enable notifications for workflow failures; independent stale-backup monitoring is still required because missed schedules do not generate failures.

Secrets: BACKUP_DATABASE_URL (direct or session-pooler Postgres URL, never transaction pooler), SOURCE_S3_ACCESS_KEY, SOURCE_S3_SECRET_KEY (Supabase Storage S3 credentials), B2_ACCESS_KEY, B2_SECRET_KEY. Use the GitHub environment secrets interface; never paste keys into chat or commit them.

Variables: BACKUP_AGE_RECIPIENT (public age recipient only), SOURCE_S3_ENDPOINT, SOURCE_S3_REGION, B2_ENDPOINT, B2_REGION, B2_BUCKET, B2_ARCHIVE_BUCKET. Set repository BACKUP_ENABLED=true temporarily for the initial manual run; leave the schedule disabled again if verification fails. Save the private age key separately/offline; it never goes into the backup runner. No public workflow artifacts contain the backup.

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

Connection remains unconfigured: no B2 bucket or GitHub environment secret was created through this implementation. The schedule stays disabled; verify first export/upload/download/decryption and managed-Supabase restore before production enablement.
