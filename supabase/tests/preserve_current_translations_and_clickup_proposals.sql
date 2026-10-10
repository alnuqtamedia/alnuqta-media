-- Integration test: existing production fixtures; all writes rolled back.
begin;
do $test$
declare a public.articles; before_article jsonb; before_translation jsonb; j newsroom_private.translation_jobs; result jsonb; ok boolean;
begin
 select * into a from public.articles where status='published' and clickup_task_id is not null limit 1 for update;
 if not found then raise exception 'Published ClickUp fixture missing'; end if;
 before_article:=to_jsonb(a);
 result:=public.ingest_clickup_article(jsonb_build_object('task_id',a.clickup_task_id,'title',a.title,'version','readiness-rollback-test','body','Proposed text only'));
 if result->>'action'<>'revision_pending' then raise exception 'Revision not queued'; end if;
 if (select to_jsonb(x) from public.articles x where id=a.id)<>before_article then raise exception 'Published article changed'; end if;
 result:=public.ingest_clickup_article(jsonb_build_object('task_id',a.clickup_task_id,'title',a.title,'version','readiness-rollback-test','body','Duplicate'));
 if result->>'action'<>'revision_already_pending' then raise exception 'Duplicate revision not deduplicated'; end if;
 select tj.* into j from newsroom_private.translation_jobs tj where newsroom_private.translation_is_current(tj.article_id,tj.source_updated_at) limit 1;
 if not found then raise exception 'Current translation fixture missing'; end if;
 perform 1 from public.articles where id=j.article_id for update;
 before_translation:=(select to_jsonb(t) from public.article_translations t where t.article_id=j.article_id and t.language='en');
 update newsroom_private.translation_jobs set state='processing',lease_until=now()+interval '3 minutes' where article_id=j.article_id;
 ok:=public.finish_newsroom_translation(j.article_id,j.token,jsonb_build_object('title','SHOULD NEVER REPLACE MANUAL TEXT'));
 if not ok then raise exception 'Current translation was not preserved'; end if;
 if (select to_jsonb(t) from public.article_translations t where t.article_id=j.article_id and t.language='en')<>before_translation then raise exception 'Manual translation overwritten'; end if;
 update newsroom_private.translation_jobs set state='pending',attempts=0,next_attempt_at=now() where article_id=j.article_id;
 result:=public.claim_newsroom_translation(j.article_id,j.token);
 if result is not null then raise exception 'Current translation claimed again'; end if;
 if (select state from newsroom_private.translation_jobs where article_id=j.article_id)<>'done' then raise exception 'Queue not reconciled'; end if;
 if has_function_privilege('anon','public.ingest_clickup_article(jsonb)','execute') or has_function_privilege('authenticated','public.finish_newsroom_translation(uuid,uuid,jsonb,text)','execute') then raise exception 'Worker permissions widened'; end if;
 raise notice 'PASS: published article unchanged; proposals deduplicated; manual translation preserved; queue reconciled; worker permissions unchanged';
end $test$;
rollback;
