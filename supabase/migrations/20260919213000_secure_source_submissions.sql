create table if not exists public.source_submissions (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 5 and 160),
  details text not null check (char_length(details) between 50 and 10000),
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size bigint check (attachment_size is null or attachment_size between 1 and 10485760),
  status text not null default 'new' check (status in ('new', 'reviewed', 'archived')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.source_submissions enable row level security;
revoke all on public.source_submissions from anon;
grant select on public.source_submissions to authenticated;
grant update (status, reviewed_by, reviewed_at) on public.source_submissions to authenticated;

create policy "editors read source submissions"
on public.source_submissions for select to authenticated
using (public.current_user_role() in ('owner', 'editor'));

create policy "editors update source submission status"
on public.source_submissions for update to authenticated
using (public.current_user_role() in ('owner', 'editor'))
with check (public.current_user_role() in ('owner', 'editor'));

create table if not exists public.source_submission_rate_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0)
);

alter table public.source_submission_rate_limits enable row level security;
revoke all on public.source_submission_rate_limits from anon, authenticated;

create or replace function public.check_source_submission_rate(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  delete from public.source_submission_rate_limits
  where window_started_at < now() - interval '24 hours';

  insert into public.source_submission_rate_limits(ip_hash, window_started_at, request_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update set
    window_started_at = case
      when source_submission_rate_limits.window_started_at < now() - interval '1 hour' then now()
      else source_submission_rate_limits.window_started_at
    end,
    request_count = case
      when source_submission_rate_limits.window_started_at < now() - interval '1 hour' then 1
      else source_submission_rate_limits.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= 5;
end;
$$;

revoke all on function public.check_source_submission_rate(text) from public, anon, authenticated;
grant execute on function public.check_source_submission_rate(text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'source-submissions',
  'source-submissions',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "editors read private source files"
on storage.objects for select to authenticated
using (
  bucket_id = 'source-submissions'
  and public.current_user_role() in ('owner', 'editor')
);

create index if not exists source_submissions_created_at_idx
on public.source_submissions (created_at desc);

create index if not exists source_submissions_status_idx
on public.source_submissions (status, created_at desc);
