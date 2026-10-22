-- Opt-in account capability. It deliberately narrows an editor's article scope.
-- Account activation is a separate verified administrative operation, not a UUID in schema history.
alter table public.profiles add column own_article_publisher boolean not null default false;
comment on column public.profiles.own_article_publisher is
  'Opt-in editor/writer: may edit, publish/unpublish and delete only articles created by or assigned as writer to this account. Not client-writable.';

create function public.current_user_own_article_publisher()
returns boolean language sql stable security invoker set search_path = '' as $$
 select coalesce((select p.own_article_publisher and p.role in ('editor','writer')
 from public.profiles p where p.id=(select auth.uid())),false)
$$;
revoke all on function public.current_user_own_article_publisher() from public,anon;
grant execute on function public.current_user_own_article_publisher() to authenticated,service_role;

-- This restrictive policy intersects the existing editor-wide policy; adding
-- only a permissive own-row policy would leave editors able to edit all rows.
create policy "own publisher scope limits article updates" on public.articles
as restrictive for update to authenticated
using (not (select public.current_user_own_article_publisher())
 or author_id=(select auth.uid()) or writer_id=(select auth.uid()))
with check (not (select public.current_user_own_article_publisher())
 or author_id=(select auth.uid()) or writer_id=(select auth.uid()));

create policy "own publishers can delete their unpublished articles" on public.articles
for delete to authenticated
using ((select public.current_user_own_article_publisher())
 and (author_id=(select auth.uid()) or writer_id=(select auth.uid()))
 and status<>'published' and clickup_task_id is null);
alter policy article_delete_requires_mfa on public.articles
using (coalesce(auth.jwt()->>'aal','')='aal2'
 or ((select public.current_user_own_article_publisher())
 and (author_id=(select auth.uid()) or writer_id=(select auth.uid()))
 and status<>'published' and clickup_task_id is null));

-- Translations are a second editing surface: narrowing articles alone would
-- still let an editor modify another writer's draft English version.
create policy "own publisher scope limits translation inserts" on public.article_translations
as restrictive for insert to authenticated
with check (not (select public.current_user_own_article_publisher()) or exists (
 select 1 from public.articles a where a.id=article_translations.article_id
 and (a.author_id=(select auth.uid()) or a.writer_id=(select auth.uid()))));
create policy "own publisher scope limits translation updates" on public.article_translations
as restrictive for update to authenticated
using (not (select public.current_user_own_article_publisher()) or exists (
 select 1 from public.articles a where a.id=article_translations.article_id
 and (a.author_id=(select auth.uid()) or a.writer_id=(select auth.uid()))))
with check (not (select public.current_user_own_article_publisher()) or exists (
 select 1 from public.articles a where a.id=article_translations.article_id
 and (a.author_id=(select auth.uid()) or a.writer_id=(select auth.uid()))));

create function public.enforce_own_article_scope()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if public.current_user_own_article_publisher() then
  if TG_OP='INSERT' then
   if new.author_id is distinct from auth.uid()
      or (new.writer_id is not null and new.writer_id is distinct from auth.uid()) then
    raise exception using errcode='42501',message='Own publisher must create their own article';
   end if;
  else
   if (old.author_id is distinct from auth.uid() and old.writer_id is distinct from auth.uid())
      or new.author_id is distinct from old.author_id
      or new.writer_id is distinct from old.writer_id then
    raise exception using errcode='42501',message='Article ownership cannot be changed by an own publisher';
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.enforce_own_article_scope() from public,anon,authenticated;
create trigger a_enforce_own_article_scope before insert or update on public.articles
for each row execute function public.enforce_own_article_scope();

create or replace function public.enforce_article_owner_insert_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
 if new.status='published' and public.current_user_role() is distinct from 'owner'
    and not (public.current_user_own_article_publisher()
      and new.author_id=auth.uid()) then
  raise exception using errcode='42501',message='Only an authorized publisher can insert published articles';
 end if;
 if new.status='published' then new.published_at:=coalesce(new.published_at,now());end if;
 return new;
end $$;

create or replace function public.enforce_article_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
declare
 r text:=public.current_user_role();
 is_clickup_sync boolean:=current_setting('app.clickup_sync',true)='on';
 own_publisher boolean:=public.current_user_own_article_publisher();
begin
 if tg_op='UPDATE' and is_clickup_sync then
  if old.status='published' then raise exception 'ClickUp cannot modify published articles directly'; end if;
  if new.status<>'review' then raise exception 'ClickUp synchronization is restricted to review status'; end if;
  new.published_at:=null;return new;
 end if;
 if tg_op='UPDATE' and old.status='published' and r<>'owner' and not own_publisher then
  raise exception 'Only an authorized publisher can modify published articles';
 end if;
 if r='owner' then null;
 elsif own_publisher and new.status in ('draft','review','ready','published') then null;
 elsif r='editor' and new.status in ('draft','review','ready') then null;
 elsif r='writer' and new.status in ('draft','review') then null;
 elsif r in ('designer','photographer','videographer') and new.status='draft' then null;
 else raise exception 'Status not allowed for role %',r;
 end if;
 if new.status='published' and old.status is distinct from 'published' then
  new.published_at:=coalesce(new.published_at,now());
 end if;
 if tg_op='UPDATE' and old.status='published' and new.status<>'published' then new.published_at:=null;end if;
 return new;
end $$;

create or replace function public.enforce_article_publish_integrity()
returns trigger language plpgsql security invoker set search_path = public as $$
declare own_publisher boolean:=public.current_user_own_article_publisher();
begin
 if new.status='published' or (tg_op='UPDATE' and old.status='published') then
  if coalesce(auth.jwt()->>'aal','')<>'aal2' and not own_publisher then
   raise exception using errcode='42501',message='MFA verification is required to publish or modify public content';
  end if;
 end if;
 -- Retain the publication checklist for every publisher, including this capability.
 if new.status='published' and (tg_op='INSERT' or old.status is distinct from 'published' or own_publisher) then
  if nullif(btrim(coalesce(new.title,'')),'') is null then raise exception 'Published article requires a title';end if;
  if nullif(btrim(coalesce(new.body,'')),'') is null and coalesce(jsonb_array_length(new.videos),0)=0 then raise exception 'Published article requires body text or video';end if;
  if new.category is null then raise exception 'Published article requires an editorial category';end if;
  if new.section in ('investigation','report','analysis') and coalesce(jsonb_array_length(new.sources),0)=0 then raise exception 'Investigations, reports and analysis require at least one source';end if;
  if coalesce(nullif(btrim(new.cover_image_url),''),nullif(btrim(new.image),'')) is not null
    and nullif(btrim(coalesce(new.cover_image_credit,'')),'') is null then raise exception 'Published article image requires a credit';end if;
 end if;
 return new;
end $$;
