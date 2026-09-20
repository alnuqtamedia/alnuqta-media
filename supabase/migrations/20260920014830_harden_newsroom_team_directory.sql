create or replace function public.newsroom_team_directory()
returns table(id uuid, email text, full_name text, role text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id,
         coalesce(u.email, '')::text,
         coalesce(p.full_name, u.raw_user_meta_data->>'full_name', '')::text,
         p.role::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where auth.uid() is not null
    and public.current_user_role() in (
      'owner', 'editor', 'writer', 'designer', 'photographer', 'videographer'
    )
    and (u.banned_until is null or u.banned_until <= now())
    and p.role in (
      'owner', 'editor', 'writer', 'designer', 'photographer', 'videographer'
    )
  order by coalesce(p.full_name, u.email, '');
$$;

revoke all on function public.newsroom_team_directory() from public, anon;
grant execute on function public.newsroom_team_directory() to authenticated, service_role;
