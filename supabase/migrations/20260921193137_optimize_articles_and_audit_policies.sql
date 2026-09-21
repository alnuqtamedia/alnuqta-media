-- Index foreign-key columns used by newsroom joins and audit history lookups.
create index if not exists articles_author_id_idx
  on public.articles (author_id);

create index if not exists audit_logs_article_id_idx
  on public.audit_logs (article_id);

create index if not exists audit_logs_user_id_idx
  on public.audit_logs (user_id);

-- Evaluate auth helpers once per statement instead of once per candidate row.
drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "writers editors owners can create articles" on public.articles;
create policy "writers editors owners can create articles"
  on public.articles
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.current_user_role()) in ('writer', 'editor', 'owner')
  );

-- Keep public reading and staff reading mutually exclusive by database role.
-- Authenticated staff still see every published article plus assigned drafts.
drop policy if exists "public can read published articles" on public.articles;
drop policy if exists "Team can read articles" on public.articles;

create policy "public can read published articles"
  on public.articles
  for select
  to anon
  using (status = 'published');

create policy "Team can read articles"
  on public.articles
  for select
  to authenticated
  using (
    status = 'published'
    or (select public.current_user_role()) in ('owner', 'editor')
    or author_id = (select auth.uid())
    or writer_id = (select auth.uid())
    or editor_id = (select auth.uid())
    or photographer_id = (select auth.uid())
    or videographer_id = (select auth.uid())
    or designer_id = (select auth.uid())
  );

drop policy if exists "Team can update assigned articles" on public.articles;
create policy "Team can update assigned articles"
  on public.articles
  for update
  to authenticated
  using (
    (select public.current_user_role()) in ('owner', 'editor')
    or author_id = (select auth.uid())
    or writer_id = (select auth.uid())
    or editor_id = (select auth.uid())
    or photographer_id = (select auth.uid())
    or videographer_id = (select auth.uid())
    or designer_id = (select auth.uid())
  )
  with check (
    (select public.current_user_role()) in ('owner', 'editor')
    or author_id = (select auth.uid())
    or writer_id = (select auth.uid())
    or editor_id = (select auth.uid())
    or photographer_id = (select auth.uid())
    or videographer_id = (select auth.uid())
    or designer_id = (select auth.uid())
  );

drop policy if exists "only owners can delete articles" on public.articles;
create policy "only owners can delete articles"
  on public.articles
  for delete
  to authenticated
  using ((select public.current_user_role()) = 'owner');
