
create function public.newsroom_translation_status() returns table(article_id uuid,state text,error_code text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_user_role() not in ('owner','editor') then raise exception 'Not authorized' using errcode='42501'; end if;
 return query select j.article_id,j.state,j.error_code from newsroom_private.translation_jobs j;
end;
$$;
revoke all on function public.newsroom_translation_status() from public,anon;
grant execute on function public.newsroom_translation_status() to authenticated;
create or replace function newsroom_private.retry_translations() returns void
language plpgsql security definer set search_path='' as $$
declare j record;
begin
 update newsroom_private.translation_jobs set state='failed',error_code=coalesce(error_code,'retry_limit'),lease_until=null
 where attempts>=6 and state='processing' and lease_until<now();
 for j in select article_id from newsroom_private.translation_jobs
 where (state='pending' or (state='processing' and lease_until<now())) and next_attempt_at<=now() and attempts<6
 order by next_attempt_at limit 3
 loop perform newsroom_private.dispatch_translation(j.article_id); end loop;
end;
$$;
