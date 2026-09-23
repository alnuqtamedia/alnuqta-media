-- Team data is now served by the authenticated manage-team Edge Function.
-- Keep the legacy functions temporarily for rollback, but remove Data API access.
revoke execute on function public.newsroom_team_directory()
  from public, anon, authenticated;
revoke execute on function public.owner_list_team()
  from public, anon, authenticated;

grant execute on function public.newsroom_team_directory() to service_role;
grant execute on function public.owner_list_team() to service_role;
