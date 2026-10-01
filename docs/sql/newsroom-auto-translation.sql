
create schema if not exists newsroom_private;
revoke all on schema newsroom_private from public, anon, authenticated;
create table newsroom_private.translation_jobs (
 article_id uuid primary key references public.articles(id) on delete cascade,
 token uuid not null default gen_random_uuid(),
 source_updated_at timestamptz not null,
 source jsonb not null,
 state text not null default 'pending' check (state in ('pending','processing','done','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 error_code text,
 updated_at timestamptz not null default now()
);
alter table newsroom_private.translation_jobs enable row level security;
revoke all on newsroom_private.translation_jobs from public, anon, authenticated;
create function newsroom_private.translation_source(a public.articles) returns jsonb
language sql immutable set search_path='' as $$
select jsonb_build_object('title',a.title,'subtitle',a.subtitle,'excerpt',a.excerpt,'body',a.body,'methodology',a.methodology,'right_of_reply',a.right_of_reply,'cover_image_caption',a.cover_image_caption,'cover_image_credit',a.cover_image_credit);
$$;
create function newsroom_private.dispatch_translation(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j newsroom_private.translation_jobs;
begin
 select * into j from newsroom_private.translation_jobs where article_id=p_id;
 if j.state not in ('pending','processing') or j.next_attempt_at>now() or j.lease_until>now() then return; end if;
 perform net.http_post(
 url:='https://zsqvmuqlmtnhndwuqlfy.supabase.co/functions/v1/newsroom-auto-translate',
 headers:=jsonb_build_object('Content-Type','application/json'),
 body:=jsonb_build_object('article_id',j.article_id,'token',j.token),timeout_milliseconds:=120000);
end;
$$;
create function newsroom_private.queue_translation() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload jsonb; unchanged boolean:=false;
begin
 payload:=newsroom_private.translation_source(new);
 if tg_op='UPDATE' then unchanged:=payload=newsroom_private.translation_source(old); end if;
 if unchanged then
   update public.article_translations set source_updated_at=new.updated_at,
     status=case when new.status='published' then 'published' else 'draft' end
   where article_id=new.id and language='en' and source_updated_at=old.updated_at;
   if found then return new; end if;
 end if;
 if nullif(btrim(new.title),'') is null then return new; end if;
 insert into newsroom_private.translation_jobs(article_id,source_updated_at,source)
 values(new.id,new.updated_at,payload)
 on conflict(article_id) do update set token=gen_random_uuid(),
 source_updated_at=excluded.source_updated_at,source=excluded.source,
 state='pending',attempts=0,next_attempt_at=now(),lease_until=null,error_code=null,updated_at=now();
 perform newsroom_private.dispatch_translation(new.id);
 return new;
end;
$$;
create trigger newsroom_auto_translation after insert or update on public.articles
for each row execute function newsroom_private.queue_translation();

create function public.claim_newsroom_translation(p_article_id uuid,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j newsroom_private.translation_jobs;
begin
 update newsroom_private.translation_jobs set state='processing',attempts=attempts+1,
 lease_until=now()+interval '3 minutes',updated_at=now()
 where article_id=p_article_id and token=p_token and
 (state='pending' or (state='processing' and lease_until<now())) and next_attempt_at<=now() and attempts<6
 returning * into j;
 if not found then return null; end if;
 return jsonb_build_object('article_id',j.article_id,'source_updated_at',j.source_updated_at,'source',j.source,'attempts',j.attempts);
end;
$$;

create function public.finish_newsroom_translation(p_article_id uuid,p_token uuid,p_translation jsonb default null,p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare j newsroom_private.translation_jobs; a public.articles; f text;
begin
 -- Lock article before job to match the article trigger's lock order.
 select * into a from public.articles where id=p_article_id for update;
 if not found then return false; end if;
 select * into j from newsroom_private.translation_jobs where article_id=p_article_id and token=p_token and state='processing' for update;
 if not found then return false; end if;
 if a.updated_at<>j.source_updated_at then return false; end if;
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
$$;
create function newsroom_private.retry_translations() returns void
language plpgsql security definer set search_path='' as $$
declare j record;
begin
 for j in select article_id from newsroom_private.translation_jobs
 where (state='pending' or (state='processing' and lease_until<now())) and next_attempt_at<=now() and attempts<6
 order by next_attempt_at limit 3
 loop perform newsroom_private.dispatch_translation(j.article_id); end loop;
end;
$$;
revoke all on all functions in schema newsroom_private from public,anon,authenticated;
revoke all on function public.claim_newsroom_translation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_newsroom_translation(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_newsroom_translation(uuid,uuid) to service_role;
grant execute on function public.finish_newsroom_translation(uuid,uuid,jsonb,text) to service_role;
select cron.schedule('newsroom-translation-retry','* * * * *','select newsroom_private.retry_translations()');
