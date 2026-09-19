-- Remove legacy policies superseded by the assignment-aware newsroom policies.
-- PostgreSQL policy names are case-sensitive, so both public-read policies existed.
drop policy if exists "Public can read published articles" on public.articles;
drop policy if exists "authenticated users can read permitted articles" on public.articles;
drop policy if exists "writers editors owners can update articles" on public.articles;

-- The rate-limit table is never exposed to browser roles. This explicit service-role
-- policy documents the intended access model while RLS remains enabled.
create policy "service role manages studio rate limits"
  on public.studio_function_rate_limits
  for all
  to service_role
  using (true)
  with check (true);

-- Pin the remaining trigger function search path and prevent direct API execution.
alter function public.set_updated_at() set search_path = public;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.enforce_article_publish_integrity() from public, anon, authenticated;
