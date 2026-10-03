create table newsroom_private.content_revisions (
 id bigint generated always as identity primary key,
 entity text not null check(entity in ('article','translation')),
 entity_id uuid not null,
 article_id uuid not null,
 captured_at timestamptz not null default clock_timestamp(),
 actor_id uuid,
 operation text not null check(operation in ('baseline','INSERT','UPDATE','DELETE')),
 snapshot jsonb not null
);
alter table newsroom_private.content_revisions enable row level security;
revoke all on newsroom_private.content_revisions from public,anon,authenticated;
create index content_revisions_article_date_idx on newsroom_private.content_revisions(article_id,captured_at desc,id desc);
create function newsroom_private.capture_content_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; entity_kind text; parent_id uuid;
begin
 if TG_OP='UPDATE' and to_jsonb(old)=to_jsonb(new) then return new; end if;
 if TG_OP='INSERT' then row_data:=to_jsonb(new); else row_data:=to_jsonb(old); end if;
 entity_kind:=case when TG_TABLE_NAME='articles' then 'article' else 'translation' end;
 parent_id:=case when entity_kind='article' then (row_data->>'id')::uuid else (row_data->>'article_id')::uuid end;
 insert into newsroom_private.content_revisions(entity,entity_id,article_id,actor_id,operation,snapshot)
 values(entity_kind,coalesce((row_data->>'id')::uuid,parent_id),parent_id,auth.uid(),TG_OP,row_data);
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
revoke all on function newsroom_private.capture_content_revision() from public,anon,authenticated;
insert into newsroom_private.content_revisions(entity,entity_id,article_id,operation,snapshot)
select 'article',id,id,'baseline',to_jsonb(a) from public.articles a;
insert into newsroom_private.content_revisions(entity,entity_id,article_id,operation,snapshot)
select 'translation',article_id,article_id,'baseline',to_jsonb(t) from public.article_translations t;
create trigger preserve_article_versions after insert or update or delete on public.articles for each row execute function newsroom_private.capture_content_revision();
create trigger preserve_translation_versions after insert or update or delete on public.article_translations for each row execute function newsroom_private.capture_content_revision();
create function public.owner_content_revisions(p_article_id uuid,p_limit integer default 30,p_before_id bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.current_user_role() is distinct from 'owner' or coalesce(auth.jwt()->>'aal','') <> 'aal2' then
 raise exception using errcode='42501',message='Owner and MFA verification required';
 end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.id desc) from
 (select id,entity,entity_id,article_id,captured_at,actor_id,operation,snapshot from newsroom_private.content_revisions
 where article_id=p_article_id and (p_before_id is null or id<p_before_id)
 order by id desc limit greatest(1,least(coalesce(p_limit,30),50))) r),'[]'::jsonb);
end $$;
revoke all on function public.owner_content_revisions(uuid,integer,bigint) from public,anon;
grant execute on function public.owner_content_revisions(uuid,integer,bigint) to authenticated;
create policy article_delete_requires_mfa on public.articles as restrictive for delete to authenticated using (coalesce(auth.jwt()->>'aal','')='aal2');

grant usage on schema newsroom_private to authenticated;
grant select on newsroom_private.content_revisions to authenticated;
create policy owner_mfa_read_versions on newsroom_private.content_revisions for select to authenticated using ((select public.current_user_role())='owner' and (select auth.jwt()->>'aal')='aal2');
alter function public.owner_content_revisions(uuid,integer,bigint) security invoker;