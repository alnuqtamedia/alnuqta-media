-- Reproducible schema for the ClickUp -> newsroom review workflow.
alter table public.articles
  add column if not exists clickup_task_id text,
  add column if not exists source_system text,
  add column if not exists source_task_url text,
  add column if not exists sync_status text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_error text,
  add column if not exists last_synced_version text;

create unique index if not exists articles_clickup_task_id_unique
  on public.articles(clickup_task_id) where clickup_task_id is not null;

create table if not exists public.clickup_article_sync_log (
  id uuid primary key default gen_random_uuid(),
  clickup_task_id text not null,
  article_id uuid references public.articles(id) on delete set null,
  event_type text not null check (event_type in ('created','updated','revision_pending','rejected','error')),
  source_version text,
  message text,
  payload_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists clickup_article_sync_log_article_id_idx on public.clickup_article_sync_log(article_id);
create index if not exists clickup_article_sync_log_task_created_idx on public.clickup_article_sync_log(clickup_task_id,created_at desc);

create table if not exists public.article_pending_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  clickup_task_id text not null,
  source_version text not null,
  proposed_changes jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(article_id,clickup_task_id,source_version)
);
create index if not exists article_pending_revisions_reviewed_by_idx on public.article_pending_revisions(reviewed_by);
create index if not exists article_pending_revisions_status_idx on public.article_pending_revisions(status,created_at desc);

alter table public.clickup_article_sync_log enable row level security;
alter table public.article_pending_revisions enable row level security;
revoke all on public.clickup_article_sync_log from public,anon,authenticated;
revoke all on public.article_pending_revisions from public,anon,authenticated;
grant select on public.clickup_article_sync_log to authenticated;
grant select,update on public.article_pending_revisions to authenticated;
grant all on public.clickup_article_sync_log,public.article_pending_revisions to service_role;

drop policy if exists "owners and editors can read clickup sync logs" on public.clickup_article_sync_log;
create policy "owners and editors can read clickup sync logs"
on public.clickup_article_sync_log for select to authenticated
using ((select public.current_user_role()) in ('owner','editor'));

drop policy if exists "owners and editors can read pending revisions" on public.article_pending_revisions;
create policy "owners and editors can read pending revisions"
on public.article_pending_revisions for select to authenticated
using ((select public.current_user_role()) in ('owner','editor'));

drop policy if exists "only owners can review pending revisions" on public.article_pending_revisions;
create policy "only owners can review pending revisions"
on public.article_pending_revisions for update to authenticated
using ((select public.current_user_role())='owner')
with check ((select public.current_user_role())='owner');

-- The polling schedule is configured separately with pg_cron + Vault.
-- Required Vault secret names: clickup_poll_project_url, clickup_poll_anon_key.
