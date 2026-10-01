
create function newsroom_private.translation_status_for_team() returns table(article_id uuid,state text,error_code text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_user_role() not in ('owner','editor') then raise exception 'Not authorized' using errcode='42501'; end if;
 return query select j.article_id,j.state,j.error_code from newsroom_private.translation_jobs j;
end;
$$;
revoke all on function newsroom_private.translation_status_for_team() from public,anon;
grant usage on schema newsroom_private to authenticated;
grant execute on function newsroom_private.translation_status_for_team() to authenticated;
create or replace function public.newsroom_translation_status() returns table(article_id uuid,state text,error_code text)
language sql security invoker set search_path='' as $$
select * from newsroom_private.translation_status_for_team();
$$;
