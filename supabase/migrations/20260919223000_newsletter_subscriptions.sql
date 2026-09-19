create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 5 and 320),
  email_normalized text generated always as (lower(btrim(email))) stored,
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  source text not null default 'website' check (source in ('homepage', 'newsroom', 'website')),
  consent_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  confirmation_token_hash text,
  confirmation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_normalized)
);

alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;
grant update (status, confirmed_at, unsubscribed_at, updated_at) on public.newsletter_subscribers to authenticated;

create policy "owner reads newsletter subscribers"
on public.newsletter_subscribers for select to authenticated
using (public.current_user_role() = 'owner');

create policy "owner updates newsletter subscribers"
on public.newsletter_subscribers for update to authenticated
using (public.current_user_role() = 'owner')
with check (public.current_user_role() = 'owner');

create table public.newsletter_rate_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0)
);

alter table public.newsletter_rate_limits enable row level security;
revoke all on public.newsletter_rate_limits from anon, authenticated;

create policy "deny direct newsletter rate access"
on public.newsletter_rate_limits for all to anon, authenticated
using (false) with check (false);

create or replace function public.check_newsletter_rate(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare current_count integer;
begin
  delete from public.newsletter_rate_limits where window_started_at < now() - interval '24 hours';
  insert into public.newsletter_rate_limits(ip_hash, window_started_at, request_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update set
    window_started_at = case when newsletter_rate_limits.window_started_at < now() - interval '1 hour' then now() else newsletter_rate_limits.window_started_at end,
    request_count = case when newsletter_rate_limits.window_started_at < now() - interval '1 hour' then 1 else newsletter_rate_limits.request_count + 1 end
  returning request_count into current_count;
  return current_count <= 10;
end;
$$;

revoke all on function public.check_newsletter_rate(text) from public, anon, authenticated;
grant execute on function public.check_newsletter_rate(text) to service_role;

create index newsletter_subscribers_status_idx on public.newsletter_subscribers(status, created_at desc);

