# Daily ZIP backup: 30-day retention

This replaces weekly/monthly emergency-backup retention proposals. Only the latest 30 days of emergency backups are retained. Nothing deletes live articles, editorial revisions or source images. Independent editorial preservation has a separate bucket and no automatic expiry.

Status (2026-10-05): the original private encryption identity was lost; the old encrypted generation is not currently recoverable. A replacement identity passed the owner’s local challenge at 12:41 UTC. Its public recipient was saved after GitHub account verification, and replacement run 37312501208 completed successfully at 12:59:45 UTC (15:59 Baghdad): 22 payload files passed integrity validation; the emergency ZIP passed encryption, upload, 30-day Compliance lock and exact-version download checksum; preservation verified 105 newly encrypted objects and 9 repeats within the new generation under a one-year Compliance lock. No full-restore success is claimed. Database and Storage connections verified. First manual emergency export passed the 22-file ZIP integrity check, encryption, upload, 30-day Compliance retention and exact-version download checksum. Long-term preservation passed: 104 new encrypted objects and 10 existing objects verified in run 37301429414. Replacement-backup decryption and offline integrity validation passed in the owner’s report at 13:32:32 UTC. A fresh partial editorial database restore has passed; frozen-archive and full managed-Supabase recovery remain untested, and scheduled backups stay disabled.

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

The daily collector captures all articles, translations and existing revision rows, including private drafts, into encrypted content-addressed records; do not expose this bucket. Images are stored by content hash and their metadata is retained separately. Unchanged records/images are reused only within the same public-recipient generation. Each generation uses `editorial/key-<SHA256-of-recipient>/`; key rotation re-encrypts unchanged source records instead of reusing objects under a lost identity. There is no delete operation. A daily collector is not instant per-publication capture; existing database revision triggers preserve intermediate texts until export, but image versions deleted before a collector run cannot be recovered. Immediate media preservation is a remaining integration requirement.

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

Run `python3 scripts/test-backup.py`. Nine tests cover recipient-generation separation, ZIP roundtrip, repeated packaging, data corruption, missing media, real media inventory, unsafe paths, unlisted entries, symlinks and nested ZIP output (roundtrip/repackage share one test). These tests need no production credentials or network.

After decrypting an actual backup, run `python3 scripts/backup-verify.py backup.zip` BEFORE extracting or restoring. It verifies exact manifest inventory, required files, SHA256 and Storage sizes without extraction. Failure stops recovery. This verifies the archive bytes; it does not prove PostgreSQL or managed Supabase restoration. The daily runner invokes it before encryption.

The Backblaze setup completed with a bucket-scoped non-delete application key on 2026-10-05. Database read-only connection and source/destination Storage roundtrip checks passed. Public age recipient was configured; the private identity stays with the owner. Run 37301021770 exported and verified the emergency backup, then stopped during preservation retention comparison. Whole-second retention timestamps and verification of previously uploaded records were added; run 37301429414 completed successfully at 11:19 UTC (14:19 Baghdad), verifying 104 new preservation objects and reverifying 10 existing objects. Bootstrap B2 credentials and the temporary GitHub setup token still require cleanup after setup verification. No successful full restore or scheduled backup is claimed.

## Local private-key and decrypted-file verification (2026-10-05)

The owner received a self-contained `alnuqta-recovery-check.html` tool. Open the downloaded file locally in Chrome, select the private age identity file, and verify the embedded public challenge. The tool checks that the derived recipient equals the configured backup recipient, without transmitting the identity or storing it in browser storage. Select a private B2 `.zip.age` backup to decrypt, verify the ZIP inventory/SHA256 and Storage metadata, and decode supported image formats. Download only the non-content JSON report for review. Never upload the private identity or decrypted database to the public repository.

The tool bundles official `age-encryption@0.3.1` and `fflate@0.8.2`; CSP denies network connections. It supports up to 200 MiB of encrypted input and 512 MiB of decompressed payload; oversized files are rejected before decompression. Its SHA256 is `86ba2f0ef6e87bb5a1d1e64cf96d3ea8aebfe72c05ffc7fdbb4fea25bfbcce6d`.

Tests passed with synthetic identities: compatibility with the previous WebCrypto key generator, age encryption/decryption, wrong-key rejection, corrupt/missing/unsafe ZIP rejection, and the bundled application's key-check/decryption/reset flows. Cloud Browser disallows local-file URLs, so its visual browser preview was not performed. No real owner identity or existing encrypted backup was decrypted by the assistant. A successful local report is not proof of PostgreSQL or managed-Supabase restoration; that isolated recovery rehearsal remains required. Scheduling remains disabled.

## Replacement identity custody (2026-10-05)

The owner’s uploaded `alnuqta-recovery-check.json` reports `keyChallengePassed: true` for `age1uhks3kfzae2rdey68utns908gdypmurxejxmev2tsruv9endry7shqa3rn`, checked at 12:41:06 UTC; `databaseRestored` is false. This proves local challenge decryption, not backup decryption, two independent key copies, or a database restore. The private identity remains with the owner. Original encrypted objects remain untouched, but must not count as recoverable unless their original identity is found. Source data remains available for replacement export.

Use `alnuqta-recovery-check-v2.html` for this identity (SHA256 `a0e1fc7ce2b4adc1b9971e96020793d3169bdd22f5f08276aae2d6d0795c1297`); the older tool targets the lost identity. All nine offline backup tests passed against the current repository scripts after the generation-separation change. Replacement-backup decryption has now passed; the scheduler remains disabled pending isolated recovery validation.

## Verified owner recovery report and live prerequisites (2026-10-05)

The owner uploaded `alnuqta-recovery-check (3).json`, kind `alnuqta-offline-recovery-check`, checked at 13:32:32.950 UTC. It reports successful key challenge and integrity validation: 22 files, 23 articles, 18 translations, 41 revisions, 15 Storage objects, 10 images decoded. Decrypted ZIP SHA256: `1aad997e141b86b5fcf318dc583c8d7ad7e39dcdbfcbba09b9281bc9bf6ba726`; encrypted SHA256: `81a92c9fb5975227e83c88863c8601048d835b480e5508964a7b0aadff278918`. Both databaseRestored and managedSupabaseRestored remain false. This is owner-supplied local evidence, not assistant execution of the private-key flow.

Read-only live queries confirmed 23/18/41 editorial counts, PostgreSQL 17.6.1.166, seven extensions (pg_cron, pg_net, pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp), two encrypted Vault records, and two active cron jobs. Do not log/read secret values through the connector. Manual restore needs the original Vault encryption root key transferred through a restricted provider-supported channel, or recreation of the affected secrets from their independently held originals; encrypted rows alone do not prove secret recovery. This key is separate from the owner’s age identity. Disable job execution/network egress in the isolated target before restoring cron state; do not disable live jobs.

Only the news and studio projects currently exist. Neither is a permissible rehearsal target. No new paid project has been created. This workspace has no Docker, psql or pg_restore, and the decrypted archive remains on the owner’s device. The actual isolated restore has therefore not run. A suitable isolated runtime with private access to the verified decrypted archive is the next prerequisite. Never upload the private identity or plaintext backup to GitHub, use the studio as a test database, or mark a fresh source export as a restore of this verified archive.

Recovery acceptance remains: restore the verified archive into an isolated compatible target, compare full editorial rows and relationships, restore Storage bytes/metadata and display images, verify RLS and Owner/MFA/manual publication, recreate required secrets/settings securely, confirm cron is inert during rehearsal, then document elapsed recovery time. Bootstrap-secret cleanup, independent stale-backup alerting, and a second independently held key/backup copy remain outstanding. Reference: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## Completed ephemeral editorial restore rehearsal (2026-10-05)

Manual workflow `.github/workflows/backup-rehearse.yml` and `scripts/backup-rehearse.py` ran successfully in run 37323270827 / job 111807471488 at 14:17:06 UTC (17:17 Baghdad), script commit d735dd199fe85ff498dde7871c71fb219aa1be02. A fresh custom-format dump and reference JSON rows were obtained from the same exported REPEATABLE READ, read-only source snapshot. A unique PostgreSQL 17.6 Docker destination had no network and no published ports; source connection credentials were not passed to it. Required table/sequence objects were allowlisted from the dump TOC, restored with pg_restore in a single transaction, and complete row JSON was compared regardless of row/key order. 23 articles, 18 translations, and 41 revisions matched exactly. The script took 79 seconds and cleaned both temporary containers and runner files. Only counts/scope reached public logs; no backup artifact or age private identity was used. This public repository used a standard Ubuntu GitHub runner; no paid Supabase project was created.

The first attempts failed because docker cp does not transfer into a tmpfs mount correctly. Streaming inputs via docker exec inside the running container and comparing their SHA256 before pg_restore resolved the failure. Offline checks covered the required-table allowlist, exclusion of Vault/Auth/automation/security objects, fail-closed missing tables, order-independent row comparison and changed-row rejection. No live source writes or changes to publication were performed.

This is a PARTIAL editorial-data restore of a FRESH source dump, not restoration of the owner-verified encrypted ZIP from B2. It intentionally omits RLS/ACL/ownership, foreign-key/index validation, Auth/MFA, Vault decryption, managed Supabase semantics, Storage service and website rendering. Combined with the owner’s successful encrypted-backup integrity check, it adds evidence that editorial custom-dump bytes can be restored, but it does not close the full disaster-recovery acceptance gates or enable BACKUP_ENABLED. The original frozen-archive restore and full application/security validation remain required. Docker transfer reference: https://docs.docker.com/reference/cli/docker/container/cp/

## Live media and access-control audit (2026-10-05 follow-up)

A read-only public Storage audit downloaded all 15 current newsroom-media objects (66,350,354 bytes) into private temporary source files, copied each to a separate temporary destination and compared SHA256. All ten images fully decoded with Pillow 12.3.0; all five videos passed ffprobe inspection with a video stream and readable duration. All five published article image/gallery references pointing into this project's public Storage matched the object inventory; zero referenced Storage objects were missing. Temporary media files were removed at completion. This is fresh-source file-copy/decoding evidence, NOT restoration of the frozen encrypted B2 archive, nor a Supabase Storage API restoration, nor a full visual website test.

Twelve distinct published images currently use external hosts and are NOT captured by the current Storage-only collector. Eleven downloaded and fully decoded during this audit. The Wikimedia Iraqi_Museum.jpg request returned HTTP 429; this is a rate-limit response, not evidence of deletion. Do not silently replace editorial images or modify protected September 22 material. External-byte collection with source/credit metadata and explicit incomplete-coverage reporting remains necessary; archive coverage cannot currently be called complete. Existing backups remain useful but retain this gap.

Live catalog inspection found two Auth users and two verified MFA factors in total; this does not prove each user's factor custody or usable recovery. The article DELETE MFA policy is RESTRICTIVE, combining with the Owner-only DELETE policy. The publication-integrity trigger requires aal2 for publishing or modifying public content; the workflow trigger limits status transitions and direct modification of published material to Owner. Article INSERT currently has publication integrity but the workflow trigger is registered only for UPDATE: full security acceptance must explicitly test insert-as-published for each team role in an isolated target before claiming Owner-only publication is fully proven. No live role impersonation, writes, publication or password resets were performed.

owner_list_team and newsroom_team_directory currently have execute ACLs only for postgres/service_role; authenticated users do not have direct execute grants. Confirm the current frontend uses its authorized Edge Function route before altering these grants. No PUBLIC grant was added during this review.

Remaining recovery gates: restore the owner-verified frozen decrypted archive privately into a compatible isolated target; recreate Storage objects through the service/API and verify URLs; exercise anonymous/team/Owner permissions and AAL1/AAL2 publication with disposable test records; verify Owner and backup-account recovery; reconstruct platform Auth settings, Edge secrets and Vault secrets from independently held originals; keep target cron/translation/ClickUp/network dispatch inert. Two encrypted Vault rows alone are insufficient to prove secret recovery. The owner identity and decrypted archive remain on the owner's device and are not available to this runtime. Do not upload either to the public repository.

BACKUP_ENABLED remains disabled. Existing partial successes must not be upgraded to full disaster-recovery certification. Documentation references: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore and https://supabase.com/docs/guides/storage/management/download-objects

## External image collection deployed and partially verified (2026-10-05)

Added scripts/backup-external-media.py and integrated it before emergency ZIP packaging. Current article covers and gallery image references are collected once per URL; gallery source metadata remains separate from cover credits. External bytes are named by SHA256 and external-media.json maps source URLs/article references to the byte files. These records and media are included in the encrypted ZIP and independent recipient-generation preservation. No live articles or September 22 material were changed. This scope excludes embedded body, document and external video URLs.

The collector permits HTTPS only on five fixed current providers, rejects credentials/nonstandard ports and redirects, caps each file at 20 MiB and limits collection count/budget. It does not forward Supabase/B2 credentials to media hosts. Missing images are recorded explicitly. After safely uploading and verifying the usable backup, the daily job exits unsuccessfully if image coverage is incomplete; it never reports complete coverage silently. Public logs show only provider/error/status; private source paths and references remain in the encrypted report.

Thirteen offline tests passed, including ZIP/preservation inclusion, corrupted external-media rejection, incomplete-coverage detection, disallowed origins/redirects, per-gallery attribution, and reference deduplication. A fresh local collector test saved and fully decoded all 12 published external images and matched SHA256. The independent read-only GitHub check (run 37330350223, job 111831560079, commit d83fc67c9f2c6d4cacb29af2a3e4cda1b4060f0d) also collected 12/12 at 15:08:45 UTC. This did NOT upload its images.

The first enhanced full backup, run 37329477067/job 111828613386 at script commit 8a06a47373bfde55fb3d1d35d2637d539af245be, collected 11/12 external images. Its 34 payload files passed integrity checking; the encrypted emergency ZIP passed upload, 30-day Compliance lock and exact-version download checksum. Preservation verified 12 new encrypted objects and 114 existing objects. The job correctly ended in failure for incomplete external coverage. One controlled rerun, job 111832221029, again collected 11/12, verified the 34-file emergency ZIP and retention/roundtrip, and reverified 126 existing preservation objects without deletion; it also correctly ended incomplete. Neither attempt is a successful complete-coverage backup.

External-only preservation was added to backup-preserve.py to preserve image bytes/mappings without creating truncated article records. The manual-only external-media-check.yml workflow now collects and preserves with the existing key/recipient/bucket/365-day Compliance verification, serialized with daily backup writes. Run 37331579023/job 111835726378 (commit 81fddeae29019ecf1a15c04a6bbc943ebfa8f508) identified the remaining current failure: upload.wikimedia.org returned HTTP 429. It preserved/reverified the available 11 images plus coverage metadata (12 existing encrypted objects), then failed its completeness check as designed. A successful earlier collector from another runtime does not prove the missing image is in B2. The exact failing path is retained in the encrypted coverage report; it was not disclosed in public logs. Do not keep retrying full exports to resolve this provider rate limit.

Current outcome: the new image-preservation capability is deployed and 11 external images are verified in independent B2 preservation; 12/12 collection succeeded in isolated checks but complete B2 external coverage remains unproven because one image request is rate-limited. Existing uploaded usable backups are retained. BACKUP_ENABLED was not enabled. Frozen encrypted-archive restoration, managed Supabase/Auth/RLS/Storage/Vault recovery, bootstrap-secret cleanup, independent stale-backup alerting and second-copy custody remain outstanding.


### External cover/gallery coverage verified (2026-10-05 15:33 UTC)

Manual external-only run 37333713579, job 111843027943, commit 1890c1a41bd3df64ea45a6309167ca24260ed9c3 succeeded. Captured 12 external images, missing 0. Preservation verified 2 new encrypted objects (the remaining image and complete coverage mapping) and reverified 11 existing objects through exact-version download and checksum, with existing 365-day compliance retention. No deletion or editorial changes. Collector now uses a descriptive archive bot identity with site contact and at most one bounded Retry-After-compliant retry. All 17 offline integrity/retry tests passed. This run did not need a retry, so it does not establish that the identity change caused provider recovery.

Coverage is current article cover/gallery images only, not embedded body documents or external videos. This closes the previous 11/12 coverage gap. Daily scheduling remains disabled. Frozen encrypted archive restoration and a complete managed Supabase Auth/RLS/Storage recovery remain unverified; successful external-media preservation does not close those gates.


### Expanded acceptance checks (2026-10-05 15:50 UTC)

24 offline integrity/retry cases passed; the offline recovery application also passed synthetic key challenge/decryption/wrong-key/corruption controls. Fresh archive UI files and their sections dependency passed the existing jsdom search/filter/pagination/Arabic-English/escaping/error-state suite. Live anon checks returned 18 published articles, zero drafts, zero stale/unpublished translations and no profile SELECT grant; private revision schema access was rejected. The live archive RPC returned 18 public items in both languages. This does not establish that every item has an approved English translation.

A new manual-only isolated publication guard workflow uses read-only source function/trigger definitions and a networkless temporary PostgreSQL destination with mock role/JWT functions. Run 37335830520, job 111850255335, commit 109e9b7673424e72a89eefa2e7bb259dd8ec6fbb reproduced two baseline acceptance failures: editor/writer with AAL2 can INSERT published rows at the trigger boundary because enforce_article_workflow_trigger is UPDATE-only. Five other baseline guard cases passed. A candidate additional owner-only published INSERT guard passed all seven cases in the temporary destination. The job correctly remains failed for the live baseline defect. No production guard or article changes were applied, and this test does not constitute full RLS/Auth end-to-end exploitation or recovery validation.

Remaining prerequisites are unchanged: private frozen archive/database restoration and a managed isolated recovery target for Auth/MFA, RLS/ACL, Storage, Vault and inert integration checks. The local file named alnuqta-editorial-backup-2026-10-03.zip is not a valid complete ZIP according to Python zipfile and must not be used for a restore; this does not invalidate the separate owner's successful 13:32 recovery report. Daily scheduling remains disabled.


### Owner-only direct publication guard deployed and checked (2026-10-05 17:42 UTC)

Applied owner_only_published_insert on the news project only. Repository migration 20261005174038_owner_only_published_insert.sql adds an invoker trigger function and BEFORE INSERT guard rejecting published inserts unless current_user_role() is owner. Existing AAL2 and checklist enforcement remain in place; draft/review/ready inserts are unchanged. No article rows were changed: 23 articles,18 translations,41 revisions before and after.

The post-deployment manual check reads all three live publication guard definitions instead of injecting a candidate. Run 37350419068, job 111899587760, source commit 33684ea8bf663018334f5ffe0606caa67c1c5fda passed all seven Owner/editor/writer INSERT/UPDATE AAL cases in networkless temporary PostgreSQL with mock JWT/role functions. The former two baseline failures are resolved at the trigger boundary. This does not certify full Auth/RLS browser flow or frozen archive restoration. Security advisor reported no new guard warnings; existing leaked-password protection warning and private translation_jobs RLS/no-policy informational finding remain. Daily backups remain disabled pending full recovery gates.
