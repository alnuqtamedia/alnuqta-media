# Editorial preservation and security — 2026-10-03

## Implemented and verified
- Baseline snapshots: 23 articles and 18 translations.
- PostgreSQL triggers retain the previous full row on UPDATE/DELETE and the new row on INSERT. Translation rows use article_id as entity_id; language is retained inside the snapshot (translations have a composite key, not an id).
- Private version table has RLS. Only Owner with AAL2 can SELECT; no client INSERT/UPDATE/DELETE grants. The public RPC is SECURITY INVOKER with explicit Owner/AAL2 verification and bounded pagination.
- Versions have no foreign key to live articles, so deleting an article does not cascade into its saved versions.
- Authenticated article deletion now additionally requires AAL2; existing Owner-only policy remains.
- Viewer: /admin/history.html. Download a complete revision JSON; recovery remains a deliberate editorial action, with no automatic publication.
- Read-only editorial snapshot captured 23 articles, 18 translations, and all 15 newsroom-media objects (66,350,354 bytes). Kept outside this public repository.
- Media size and SHA256 verification passed. Isolated SQLite reconstruction passed for 23 article JSON records and 18 translation records. This is NOT a complete PostgreSQL/Supabase disaster recovery test.
- UPDATE/DELETE snapshot capture tested in a rolled-back transaction; real editorial content unchanged.
- Owner/AAL2 visibility and missing-session/AAL1 denial tested.
- Supabase advisor: no new security warnings after changing the RPC to SECURITY INVOKER. Existing Free-tier leaked-password protection warning remains. Private translation_jobs is intentionally closed with RLS and no policies.

## Boundaries
Historical versions before this rollout cannot be reconstructed. Versions in the same project are not independent backups and do not contain image bytes. The one-time independent editorial backup excludes Auth credentials, private source submissions, newsletter subscriber data, application secrets, database extensions, full roles/policies, and images hosted by third parties. It does not replace a full logical PostgreSQL dump.

## Production backup target
Based on CISA and Supabase guidance:
1. Daily logical database dump through Supabase CLI/pg_dump, encrypted before upload. Include schema, policies, functions and eligible application data. Treat auth and confidential source data as highly restricted.
2. Independent copy of Storage bytes and object metadata. Database dumps alone do not include Storage objects.
3. Separate provider/account; protect deletion with object retention/lock where supported; no credentials in site JS, GitHub contents, job logs or public artifacts.
4. Retention proposal: 30 daily, 12 weekly and 12 monthly copies; keep a separate offline copy. This policy is proposed, not configured.
5. Weekly integrity checks; monthly isolated PostgreSQL/Supabase recovery rehearsal (including images, IDs, translations, roles, RLS and publication checks).
6. Alert on missing/stale backups, failed exports, or capacity over 70%/85%.
7. Proposed recovery targets: at most 24 hours of data loss (daily backup RPO), restore within 4 hours (RTO). These are targets, not guarantees until full recovery testing.

## Access still needed
The connector does not expose database connection credentials, GitHub secret writes, external backup storage settings, Auth configuration, monthly Usage billing metrics or domain registrar account controls. A secure secret channel and independent destination must be selected before unattended backups can be enabled. Never ask for credentials pasted into chat.
Backup Owner account recovery must be tested before tightening login requirements. No password reset or paid-plan upgrade was performed.
Recommended production evaluation: Supabase Pro daily backups plus independent Storage/off-site copies; costs require separate authorization.

## References
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/storage/management/download-objects
- https://www.cisa.gov/stopransomware/ransomware-guide
- https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
