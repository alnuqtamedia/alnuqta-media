create or replace function newsroom_private.translation_is_current(p_article_id uuid,p_source_updated_at timestamptz)
returns boolean language sql stable set search_path='' as $$
 select exists(
  select 1 from public.articles a join public.article_translations t on t.article_id=a.id and t.language='en'
  where a.id=p_article_id and a.updated_at=p_source_updated_at and t.source_updated_at=p_source_updated_at
  and not exists(
   select 1 from unnest(array['title','subtitle','excerpt','body','methodology','right_of_reply','cover_image_caption','cover_image_credit']) f
   where nullif(btrim(to_jsonb(a)->>f),'') is not null and nullif(btrim(to_jsonb(t)->>f),'') is null
  )
 );
$$;
revoke all on function newsroom_private.translation_is_current(uuid,timestamptz) from public,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ingest_clickup_article(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_task_id text := nullif(btrim(p_payload->>'task_id'),'');
  v_title text := nullif(btrim(p_payload->>'title'),'');
  v_article public.articles%rowtype;
  v_version text := coalesce(nullif(btrim(p_payload->>'version'),''), encode(digest(p_payload::text,'sha256'),'hex'));
  v_section text := coalesce(nullif(btrim(p_payload->>'section'),''),'news');
  v_category text := nullif(btrim(p_payload->>'category'),'');
  v_exists boolean := false;
begin
  if v_task_id is null or char_length(v_task_id)>100 then raise exception 'Invalid ClickUp task_id'; end if;
  if v_title is null or char_length(v_title)>300 then raise exception 'Invalid article title'; end if;
  if v_section not in ('investigation','report','news','analysis','interview','human-story','video','gallery','opinion') then v_section:='news'; end if;
  v_category := public.normalize_editorial_category(v_category);

  select * into v_article from public.articles where clickup_task_id=v_task_id for update;
  v_exists := found;

  if v_exists and v_article.status='published' then
    insert into public.article_pending_revisions(article_id,clickup_task_id,source_version,proposed_changes)
    values(v_article.id,v_task_id,v_version,p_payload)
    on conflict(article_id,clickup_task_id,source_version) do nothing;
    if not found then return jsonb_build_object('ok',true,'action','revision_already_pending','article_id',v_article.id); end if;
    -- Published content and timestamps remain under Owner/AAL2 control.
    insert into public.clickup_article_sync_log(clickup_task_id,article_id,event_type,source_version,message,payload_summary)
    values(v_task_id,v_article.id,'revision_pending',v_version,'Published article protected; revision queued',jsonb_build_object('title',v_title,'status','review'));
    return jsonb_build_object('ok',true,'action','revision_pending','article_id',v_article.id);
  end if;

  perform set_config('app.clickup_sync','on',true);
  if v_exists then
    update public.articles set
      title=v_title,subtitle=nullif(btrim(p_payload->>'subtitle'),''),excerpt=nullif(btrim(p_payload->>'excerpt'),''),
      body=nullif(p_payload->>'body',''),section=v_section,category=v_category,image=nullif(btrim(p_payload->>'image'),''),
      cover_image_url=coalesce(nullif(btrim(p_payload->>'cover_image_url'),''),nullif(btrim(p_payload->>'image'),'')),
      cover_image_caption=nullif(btrim(p_payload->>'cover_image_caption'),''),cover_image_credit=nullif(btrim(p_payload->>'cover_image_credit'),''),
      methodology=nullif(p_payload->>'methodology',''),right_of_reply=nullif(p_payload->>'right_of_reply',''),
      sources=case when jsonb_typeof(p_payload->'sources')='array' then p_payload->'sources' else '[]'::jsonb end,
      status='review',source_system='clickup',source_task_url=nullif(btrim(p_payload->>'task_url'),''),
      sync_status='synced',last_synced_at=now(),last_synced_version=v_version,last_sync_error=null
    where id=v_article.id returning * into v_article;
    insert into public.clickup_article_sync_log(clickup_task_id,article_id,event_type,source_version,message,payload_summary)
    values(v_task_id,v_article.id,'updated',v_version,'ClickUp material updated in review',jsonb_build_object('title',v_title,'status','review'));
    return jsonb_build_object('ok',true,'action','updated','article_id',v_article.id);
  end if;

  insert into public.articles(
    title,subtitle,excerpt,body,section,category,image,cover_image_url,cover_image_caption,cover_image_credit,
    methodology,right_of_reply,sources,status,clickup_task_id,source_system,source_task_url,sync_status,last_synced_at,last_synced_version
  ) values (
    v_title,nullif(btrim(p_payload->>'subtitle'),''),nullif(btrim(p_payload->>'excerpt'),''),nullif(p_payload->>'body',''),
    v_section,v_category,nullif(btrim(p_payload->>'image'),''),
    coalesce(nullif(btrim(p_payload->>'cover_image_url'),''),nullif(btrim(p_payload->>'image'),'')),
    nullif(btrim(p_payload->>'cover_image_caption'),''),nullif(btrim(p_payload->>'cover_image_credit'),''),
    nullif(p_payload->>'methodology',''),nullif(p_payload->>'right_of_reply',''),
    case when jsonb_typeof(p_payload->'sources')='array' then p_payload->'sources' else '[]'::jsonb end,
    'review',v_task_id,'clickup',nullif(btrim(p_payload->>'task_url'),''),'synced',now(),v_version
  ) returning * into v_article;
  insert into public.clickup_article_sync_log(clickup_task_id,article_id,event_type,source_version,message,payload_summary)
  values(v_task_id,v_article.id,'created',v_version,'ClickUp material created in review',jsonb_build_object('title',v_title,'status','review'));
  return jsonb_build_object('ok',true,'action','created','article_id',v_article.id);
end;
$function$;
CREATE OR REPLACE FUNCTION public.claim_newsroom_translation(p_article_id uuid, p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j newsroom_private.translation_jobs; a public.articles;
begin
 select * into a from public.articles where id=p_article_id for update;
 if not found then return null; end if;
 select * into j from newsroom_private.translation_jobs where article_id=p_article_id and token=p_token for update;
 if not found then return null; end if;
 if newsroom_private.translation_is_current(p_article_id,j.source_updated_at) then
  update newsroom_private.translation_jobs set state='done',lease_until=null,error_code=null,updated_at=now() where article_id=p_article_id and token=p_token;
  return null;
 end if;
 update newsroom_private.translation_jobs set state='processing',attempts=attempts+1,
 lease_until=now()+interval '3 minutes',updated_at=now()
 where article_id=p_article_id and token=p_token and
 (state='pending' or (state='processing' and lease_until<now())) and next_attempt_at<=now() and attempts<6
 returning * into j;
 if not found then return null; end if;
 return jsonb_build_object('article_id',j.article_id,'source_updated_at',j.source_updated_at,'source',j.source,'attempts',j.attempts);
end;
$function$;
CREATE OR REPLACE FUNCTION public.finish_newsroom_translation(p_article_id uuid, p_token uuid, p_translation jsonb DEFAULT NULL::jsonb, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j newsroom_private.translation_jobs; a public.articles; f text;
begin
 -- Lock article before job to match the article trigger's lock order.
 select * into a from public.articles where id=p_article_id for update;
 if not found then return false; end if;
 select * into j from newsroom_private.translation_jobs where article_id=p_article_id and token=p_token and state='processing' for update;
 if not found then return false; end if;
 if a.updated_at<>j.source_updated_at then return false; end if;
 -- Recheck after claiming: a human may have saved while the provider was running.
 if newsroom_private.translation_is_current(p_article_id,j.source_updated_at) then
  update newsroom_private.translation_jobs set state='done',lease_until=null,error_code=null,updated_at=now() where article_id=p_article_id and token=p_token;
  return true;
 end if;
 if p_error is not null then
 update newsroom_private.translation_jobs set state=case when attempts>=6 then 'failed' else 'pending' end,
 next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),
 lease_until=null,error_code=left(p_error,80),updated_at=now() where article_id=p_article_id;
 return false;
 end if;
 foreach f in array array['title','subtitle','excerpt','body','methodology','right_of_reply','cover_image_caption','cover_image_credit'] loop
 if coalesce(j.source->>f,'')<>'' and nullif(btrim(p_translation->>f),'') is null then raise exception 'Incomplete translated field: %',f; end if;
 end loop;
 insert into public.article_translations(article_id,language,status,title,subtitle,excerpt,body,methodology,right_of_reply,cover_image_caption,cover_image_credit,source_updated_at,updated_at)
 values(a.id,'en',case when a.status='published' then 'published' else 'draft' end,
 p_translation->>'title',p_translation->>'subtitle',p_translation->>'excerpt',p_translation->>'body',p_translation->>'methodology',p_translation->>'right_of_reply',p_translation->>'cover_image_caption',p_translation->>'cover_image_credit',a.updated_at,now())
 on conflict(article_id,language) do update set status=excluded.status,title=excluded.title,subtitle=excluded.subtitle,
 excerpt=excluded.excerpt,body=excluded.body,methodology=excluded.methodology,right_of_reply=excluded.right_of_reply,
 cover_image_caption=excluded.cover_image_caption,cover_image_credit=excluded.cover_image_credit,
 source_updated_at=excluded.source_updated_at,updated_at=excluded.updated_at;
 update newsroom_private.translation_jobs set state='done',lease_until=null,error_code=null,updated_at=now() where article_id=p_article_id;
 return true;
end;
$function$;
CREATE OR REPLACE FUNCTION newsroom_private.retry_translations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j record;
begin
 update newsroom_private.translation_jobs j set state='done',lease_until=null,error_code=null,updated_at=now()
 where j.state in ('pending','processing','failed') and newsroom_private.translation_is_current(j.article_id,j.source_updated_at);
 update newsroom_private.translation_jobs set state='failed',error_code=coalesce(error_code,'retry_limit'),lease_until=null
 where attempts>=6 and state='processing' and lease_until<now();
 for j in select article_id from newsroom_private.translation_jobs
 where (state='pending' or (state='processing' and lease_until<now())) and next_attempt_at<=now() and attempts<6
 order by next_attempt_at limit 3
 loop perform newsroom_private.dispatch_translation(j.article_id); end loop;
end;
$function$;
-- Reconcile jobs already satisfied by a complete current translation.
update newsroom_private.translation_jobs j set state='done',lease_until=null,error_code=null,updated_at=now() where j.state in ('pending','processing','failed') and newsroom_private.translation_is_current(j.article_id,j.source_updated_at);