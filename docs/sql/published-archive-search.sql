
create or replace function public.archive_normalize(p_text text)
returns text language sql immutable parallel safe security invoker set search_path=''
as $$ select lower(translate(regexp_replace(coalesce(p_text,''),'[ًٌٍَُِّْٰـ]','','g'),'أإآٱى','ااااي')); $$;
revoke all on function public.archive_normalize(text) from public;
grant execute on function public.archive_normalize(text) to anon,authenticated,service_role;
create index if not exists articles_archive_date_idx on public.articles (coalesce(published_at,created_at) desc,id) where status='published';
create index if not exists articles_archive_search_idx on public.articles using gin
(to_tsvector('simple'::regconfig,public.archive_normalize(coalesce(title,'')||' '||coalesce(subtitle,'')||' '||coalesce(excerpt,'')||' '||coalesce(body,'')||' '||coalesce(writer_name,'')))) where status='published';
create index if not exists translations_archive_search_idx on public.article_translations using gin
(to_tsvector('simple'::regconfig,public.archive_normalize(coalesce(title,'')||' '||coalesce(subtitle,'')||' '||coalesce(excerpt,'')||' '||coalesce(body,'')))) where language='en' and status='published';
create or replace function public.search_newsroom_archive(
p_query text default '',p_category text default '',p_type text default '',p_writer text default '',
p_from date default null,p_to date default null,p_language text default 'ar',
p_sort text default 'newest',p_offset integer default 0,p_limit integer default 20,p_facets boolean default false)
returns jsonb language sql stable security invoker set search_path='' set statement_timeout='5s'
as $$
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
 and (coalesce(p_category,'')='' or a.category=p_category or (p_category='field-social' and a.category is null and a.section='investigation'))
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
$$;
revoke all on function public.search_newsroom_archive(text,text,text,text,date,date,text,text,integer,integer,boolean) from public;
grant execute on function public.search_newsroom_archive(text,text,text,text,date,date,text,text,integer,integer,boolean) to anon,authenticated,service_role;
