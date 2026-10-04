-- Compatibility migration. Keep all existing article rows byte-for-byte unchanged.
-- Reclassifying published rows would invalidate reviewed translations through updated_at.
-- Sept 22 material is protected. Legacy categories are normalized for display/search only.
BEGIN;
ALTER TABLE public.articles DROP CONSTRAINT articles_category_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_category_check CHECK
(category IS NULL OR category IN ('politics','world','economy','iraq','sports','arts','misc',
'economy-public-money','field-social','culture-arts','travel-tourism','human-stories'));
ALTER TABLE public.articles DROP CONSTRAINT articles_section_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_section_check CHECK
(section IN ('investigation','report','news','analysis','interview','human-story','video','gallery','opinion'));
COMMENT ON COLUMN public.articles.category IS 'Editorial category: politics, world, economy, iraq, sports, arts, misc. Legacy values retained for protected articles and reviewed translations.';
CREATE OR REPLACE FUNCTION public.normalize_editorial_category(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path=''
AS $$ SELECT CASE lower(btrim(coalesce(value,'')))
WHEN 'politics' THEN 'politics' WHEN 'world' THEN 'world' WHEN 'iraq' THEN 'iraq'
WHEN 'sports' THEN 'sports' WHEN 'economy' THEN 'economy' WHEN 'economy-public-money' THEN 'economy'
WHEN 'arts' THEN 'arts' WHEN 'culture-arts' THEN 'arts' ELSE 'misc' END $$;
REVOKE ALL ON FUNCTION public.normalize_editorial_category(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_editorial_category(text) TO anon,authenticated,service_role;
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
;
CREATE OR REPLACE FUNCTION public.search_newsroom_archive(p_query text DEFAULT ''::text, p_category text DEFAULT ''::text, p_type text DEFAULT ''::text, p_writer text DEFAULT ''::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_language text DEFAULT 'ar'::text, p_sort text DEFAULT 'newest'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 20, p_facets boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
with params as (select plainto_tsquery('simple'::regconfig,public.archive_normalize(left(coalesce(p_query,''),200))) as q),
matched as (
 select a.id,case when p_language='en' and t.article_id is not null then t.title else a.title end as title,
 case when p_language='en' and t.article_id is not null then t.excerpt else a.excerpt end as excerpt,
 case when p_language='en' and t.article_id is not null then t.subtitle else a.subtitle end as subtitle,
 a.section,a.category,a.writer_name,coalesce(a.published_at,a.created_at) as published_at,a.updated_at,a.reading_time,
 coalesce(nullif(a.cover_image_url,''),a.image) as image,(t.article_id is not null) as translation_available
 from public.articles a
 left join public.article_translations t on t.article_id=a.id and t.language='en' and t.status='published' and t.source_updated_at=a.updated_at
 cross join params
 where a.status='published'
 and (coalesce(p_category,'')='' or public.normalize_editorial_category(a.category)=public.normalize_editorial_category(p_category))
 and (coalesce(p_type,'')='' or a.section=p_type)
 and (coalesce(p_writer,'')='' or a.writer_name=p_writer)
 and (p_from is null or coalesce(a.published_at,a.created_at)>= (p_from::timestamp at time zone 'Asia/Baghdad'))
 and (p_to is null or coalesce(a.published_at,a.created_at)< ((p_to+1)::timestamp at time zone 'Asia/Baghdad'))
 and (numnode(params.q)=0
 or to_tsvector('simple'::regconfig,public.archive_normalize(coalesce(a.title,'')||' '||coalesce(a.subtitle,'')||' '||coalesce(a.excerpt,'')||' '||coalesce(a.body,'')||' '||coalesce(a.writer_name,''))) @@ params.q
 or to_tsvector('simple'::regconfig,public.archive_normalize(coalesce(t.title,'')||' '||coalesce(t.subtitle,'')||' '||coalesce(t.excerpt,'')||' '||coalesce(t.body,''))) @@ params.q)
), page as (
 select * from matched order by
 case when p_sort='oldest' then published_at end asc nulls last,
 case when p_sort<>'oldest' or p_sort is null then published_at end desc nulls last,id
 limit greatest(1,least(coalesce(p_limit,20),40)) offset greatest(0,least(coalesce(p_offset,0),100000))
)
select jsonb_build_object('total',(select count(*) from matched),
 'items',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
 'facets',case when p_facets then jsonb_build_object(
 'total',(select count(*) from public.articles where status='published'),
 'years',coalesce((select jsonb_agg(y order by y desc) from (select distinct extract(year from coalesce(published_at,created_at) at time zone 'Asia/Baghdad')::int y from public.articles where status='published') s),'[]'::jsonb),
 'writers',coalesce((select jsonb_agg(w order by w) from (select distinct writer_name w from public.articles where status='published' and nullif(btrim(writer_name),'') is not null) s),'[]'::jsonb)
 ) else null end);
$function$
;
COMMIT;
