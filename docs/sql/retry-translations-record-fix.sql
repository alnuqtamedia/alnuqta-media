CREATE OR REPLACE FUNCTION newsroom_private.retry_translations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare retry_job record;
begin
 update newsroom_private.translation_jobs j set state='done',lease_until=null,error_code=null,updated_at=now()
 where j.state in ('pending','processing','failed') and newsroom_private.translation_is_current(j.article_id,j.source_updated_at);
 update newsroom_private.translation_jobs set state='failed',error_code=coalesce(error_code,'retry_limit'),lease_until=null
 where attempts>=6 and state='processing' and lease_until<now();
 for retry_job in select article_id from newsroom_private.translation_jobs
 where (state='pending' or (state='processing' and lease_until<now())) and next_attempt_at<=now() and attempts<6
 order by next_attempt_at limit 3
 loop perform newsroom_private.dispatch_translation(retry_job.article_id); end loop;
end;
$function$
