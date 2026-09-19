create table if not exists public.studio_function_rate_limits (
  function_name text not null,
  ip_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (function_name, ip_hash, window_started_at),
  constraint studio_function_rate_limits_function_check check (
    function_name in ('gemini-studio', 'gemini-image', 'pexels-search', 'gemini-tts')
  ),
  constraint studio_function_rate_limits_hash_check check (ip_hash ~ '^[0-9a-f]{64}$')
);

alter table public.studio_function_rate_limits enable row level security;
revoke all on table public.studio_function_rate_limits from public, anon, authenticated;

create or replace function public.check_studio_function_rate_limit(
  p_function_name text,
  p_ip_hash text,
  p_limit integer default 20,
  p_window_seconds integer default 3600
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_function_name not in ('gemini-studio', 'gemini-image', 'pexels-search', 'gemini-tts')
     or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_limit not between 1 and 1000
     or p_window_seconds not between 60 and 86400 then
    raise exception 'invalid rate-limit arguments';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.studio_function_rate_limits
    (function_name, ip_hash, window_started_at, request_count)
  values (p_function_name, p_ip_hash, v_window_start, 1)
  on conflict (function_name, ip_hash, window_started_at)
  do update set request_count = public.studio_function_rate_limits.request_count + 1
  where public.studio_function_rate_limits.request_count < p_limit
  returning request_count into v_count;

  if v_count is null then
    return query select false,
      greatest(1, ceil(extract(epoch from
        (v_window_start + make_interval(secs => p_window_seconds) - v_now)
      ))::integer);
  else
    return query select true, 0;
  end if;
end;
$$;

revoke all on function public.check_studio_function_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_studio_function_rate_limit(text, text, integer, integer)
  to service_role;

-- These trigger functions are invoked by PostgreSQL triggers only.
revoke execute on function public.enforce_article_workflow() from public, anon, authenticated;
revoke execute on function public.write_article_audit_log() from public, anon, authenticated;

-- These RPCs require a signed-in newsroom member. Anonymous callers do not need them.
revoke execute on function public.current_user_role() from anon;
revoke execute on function public.newsroom_team_directory() from anon;
revoke execute on function public.owner_list_team() from anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.newsroom_team_directory() to authenticated;
grant execute on function public.owner_list_team() to authenticated;

create index if not exists studio_function_rate_limits_window_idx
  on public.studio_function_rate_limits (window_started_at);
