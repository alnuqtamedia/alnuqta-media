-- Applied 2026-10-08. Random 32-byte unsubscribe tokens are stored only as SHA-256 hashes.
alter table public.newsletter_subscribers add column if not exists unsubscribe_token_hash text;
create unique index if not exists newsletter_unsubscribe_token_idx
on public.newsletter_subscribers(unsubscribe_token_hash) where unsubscribe_token_hash is not null;
-- Existing RLS and grants remain in force. Only the server writes token hashes.
