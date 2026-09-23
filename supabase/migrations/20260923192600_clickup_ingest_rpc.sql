-- Track the live ClickUp ingestion RPC used by the newsroom polling functions.
-- Secrets and cron authorization remain in Supabase Vault/Edge Function Secrets.

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
  if v_section not in ('investigation','report','news','analysis','interview','human-story','video','gallery') then v_section:='news'; end if;
  if v_category is not null and v_category not in ('politics','economy-public-money','field-social','culture-arts','travel-tourism','sports') then v_category:=null; end if;

  select * into v_article from public.articles where clickup_task_id=v_task_id for update;
  v_exists := found;

  if v_exists and v_article.status='published' then
    insert into public.article_pending_revisions(article_id,clickup_task_id,source_version,proposed_changes)
    values(v_article.id,v_task_id,v_version,p_payload)
    on conflict(article_id,clickup_task_id,source_version) do update set proposed_changes=excluded.proposed_changes,created_at=now();
    update public.articles set sync_status='revision_pending',last_synced_at=now(),last_synced_version=v_version,last_sync_error=null where id=v_article.id;
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
$function$


revoke all on function public.ingest_clickup_article(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_clickup_article(jsonb) to service_role;
