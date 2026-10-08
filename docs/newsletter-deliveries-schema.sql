-- Applied 2026-10-08: a persistent claim prevents duplicate or uncertain delivery retries.
create table if not exists public.newsletter_deliveries(issue text not null,subscriber_id uuid not null references public.newsletter_subscribers(id),state text not null check(state in ('processing','sent','failed','skipped')),created_at timestamptz not null default now(),primary key(issue,subscriber_id));
alter table public.newsletter_deliveries enable row level security;
revoke all on public.newsletter_deliveries from public,anon,authenticated;
grant select on public.newsletter_deliveries to authenticated;
create policy newsletter_deliveries_owner_read on public.newsletter_deliveries for select to authenticated using (public.current_user_role()='owner');
