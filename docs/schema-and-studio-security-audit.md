# Actual schema and studio security audit

Audit date: 2026-09-19  
Supabase project: `zsqvmuqlmtnhndwuqlfy`

## Database comparison

The live database was inspected directly. `public.profiles`, `public.articles`,
`current_user_role()`, `owner_list_team()`, and `newsroom_team_directory()` already
exist, so the speculative `docs/proposed-schema-articles-profiles.sql` must not be
applied as a baseline migration.

Important differences from the proposal:

- `articles` has 33 columns, including assignment IDs, media metadata, `category`,
  and legacy `author_id` / `editor_id` fields.
- `profiles.role` supports `owner`, `editor`, `writer`, `designer`, `photographer`,
  and `videographer`.
- Live RLS includes public published reads and assignment-aware newsroom access.
- `enforce_article_workflow_trigger` runs before updates. Its function permits
  `published` only for `owner`; writer is limited to `draft`/`review`, editor to
  `draft`/`review`/`ready`, and production roles to `draft`.
- `enforce_article_publish_integrity_trigger` separately requires a title and
  body or video for published content.

No tables were recreated. The gap-only migrations in this change:

- remove superseded duplicate article policies;
- revoke browser execution of trigger-only functions and anonymous execution of
  newsroom RPCs;
- pin the remaining trigger function search path;
- create the private shared rate-limit table and RPC used by studio functions.

## Edge Function protection

The four live functions were downloaded from Supabase before editing. Their
provider logic was retained and the following shared guard was added:

1. Require an allowed `Origin` before handling preflight or POST requests.
2. Echo only that verified origin in `Access-Control-Allow-Origin`.
3. Hash the forwarded network address with SHA-256 and a server-side salt; never
   store the raw address.
4. Atomically allow 20 requests per function, fingerprint, and one-hour window.
5. Return `429` with `Retry-After` when the limit is reached.

Default allowed origin: `https://alnuqtamedia.github.io`. Extra origins may be
configured with the comma-separated `STUDIO_ALLOWED_ORIGINS` secret. Do not add
untrusted origins.

## Live verification

- POST without `Origin`: `403 {"error":"origin_not_allowed"}`.
- Preflight from `https://evil.example`: `403`.
- Preflight from `https://alnuqtamedia.github.io`: `204`, with the exact origin.
- Allowed-origin POST with an empty TTS payload: reached application validation
  and returned `400` without calling Gemini.
- Database grants confirm only `service_role` can call the rate-limit RPC.

## Security boundary

An Origin allowlist blocks ordinary cross-site browser abuse but is not identity
authentication: command-line clients can forge an `Origin` header. Rate limiting
therefore remains essential. Stronger protection would require authenticated
studio users (JWT) or moving provider calls behind a private application backend.

Also, GitHub Pages uses the origin only (scheme + host); a project path is not part
of `Origin`. If the main site and studio share `https://alnuqtamedia.github.io`, the
browser cannot distinguish their paths using Origin alone. A dedicated studio
subdomain would provide a truly studio-specific origin.
