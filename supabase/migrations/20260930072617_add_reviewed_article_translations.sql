-- English versions are independent editorial records. Arabic articles are unchanged.
create table public.article_translations (
 article_id uuid not null references public.articles(id) on delete cascade,
 language text not null default 'en' check (language = 'en'),
 status text not null default 'draft' check (status in ('draft','review','ready','published')),
 title text not null check (length(btrim(title)) > 0),
 subtitle text, excerpt text, body text, methodology text, right_of_reply text,
 cover_image_caption text, cover_image_credit text,
 source_updated_at timestamptz not null,
 updated_at timestamptz not null default now(),
 primary key(article_id,language)
);
alter table public.article_translations enable row level security;
revoke all on public.article_translations from anon, authenticated;
grant select on public.article_translations to anon, authenticated;
grant insert, update on public.article_translations to authenticated;
create policy translations_public_read on public.article_translations for select to anon, authenticated
using (status='published' and exists(select 1 from public.articles a where a.id=article_id and a.status='published' and a.updated_at=source_updated_at));
create policy translations_team_read on public.article_translations for select to authenticated
using ((select public.current_user_role()) in ('owner','editor'));
create policy translations_team_insert on public.article_translations for insert to authenticated
with check ((select public.current_user_role()) in ('owner','editor') and
 (status <> 'published' or ((select public.current_user_role())='owner' and (select auth.jwt()->>'aal')='aal2')));
create policy translations_team_update on public.article_translations for update to authenticated
using ((select public.current_user_role()) in ('owner','editor') and
 (status <> 'published' or ((select public.current_user_role())='owner' and (select auth.jwt()->>'aal')='aal2')))
with check ((select public.current_user_role()) in ('owner','editor') and
 (status <> 'published' or ((select public.current_user_role())='owner' and (select auth.jwt()->>'aal')='aal2')));
