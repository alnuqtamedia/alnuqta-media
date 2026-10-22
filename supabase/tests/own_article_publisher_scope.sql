-- Run inside BEGIN, after setting test.own_scope_subject to a verified editor UUID.
-- All fixture writes, audit rows, revisions and queued translations roll back.
set local lock_timeout='3s';
set local statement_timeout='30s';
select set_config('test.own_scope_owner',(select id::text from public.profiles where role='owner' limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.own_scope_owner'),'role','authenticated','aal','aal2')::text,true);
update public.profiles set own_article_publisher=true where id=current_setting('test.own_scope_subject')::uuid;
create temporary table scope_test_ids(kind text,id uuid default gen_random_uuid());
insert into scope_test_ids(kind) values('own'),('assigned'),('foreign'),('new');
grant select on scope_test_ids to authenticated;
insert into public.articles(id,title,body,section,category,status,author_id,writer_id,editor_id)
select id,'Temporary permission check','Synthetic fixture; rolled back','news','iraq','draft',
 case when kind='own' then current_setting('test.own_scope_subject')::uuid else current_setting('test.own_scope_owner')::uuid end,
 case when kind='assigned' then current_setting('test.own_scope_subject')::uuid else null end,
 case when kind='foreign' then current_setting('test.own_scope_subject')::uuid else null end
from scope_test_ids where kind<>'new';
insert into public.article_translations(article_id,language,status,title,body,source_updated_at)
select id,'en','draft','Synthetic translation','Synthetic text',now() from scope_test_ids where kind in ('own','foreign');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.own_scope_subject'),'role','authenticated','aal','aal1')::text,true);
do $test$
declare n integer;denied boolean;
begin
 if not public.current_user_own_article_publisher() then raise exception 'Capability not recognized';end if;
 update public.articles set title='Allowed own edit' where id=(select id from scope_test_ids where kind='own');get diagnostics n=row_count;if n<>1 then raise exception 'Own edit blocked';end if;
 update public.articles set title='Allowed writer edit' where id=(select id from scope_test_ids where kind='assigned');get diagnostics n=row_count;if n<>1 then raise exception 'Assigned writer edit blocked';end if;
 update public.articles set title='Forbidden foreign edit' where id=(select id from scope_test_ids where kind='foreign');get diagnostics n=row_count;if n<>0 then raise exception 'Foreign edit allowed';end if;
 update public.articles set writer_id=auth.uid() where id=(select id from scope_test_ids where kind='foreign');get diagnostics n=row_count;if n<>0 then raise exception 'Foreign takeover allowed';end if;
 denied:=false;begin update public.articles set author_id=current_setting('test.own_scope_owner')::uuid where id=(select id from scope_test_ids where kind='own');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Ownership transfer allowed';end if;
 denied:=false;begin update public.profiles set own_article_publisher=false where id=auth.uid();exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Client could change capability';end if;
 update public.article_translations set title='Allowed own translation edit' where article_id=(select id from scope_test_ids where kind='own');get diagnostics n=row_count;if n<>1 then raise exception 'Own draft translation blocked';end if;
 update public.article_translations set title='Forbidden foreign translation' where article_id=(select id from scope_test_ids where kind='foreign');get diagnostics n=row_count;if n<>0 then raise exception 'Foreign translation edit allowed';end if;
 update public.articles set status='published' where id=(select id from scope_test_ids where kind='own');get diagnostics n=row_count;if n<>1 then raise exception 'Own publication blocked';end if;
 update public.articles set body='Allowed published edit at AAL1' where id=(select id from scope_test_ids where kind='own');get diagnostics n=row_count;if n<>1 then raise exception 'Own published edit blocked';end if;
 if not exists(select 1 from public.articles where id=(select id from scope_test_ids where kind='own') and published_at is not null) then raise exception 'Publication timestamp missing';end if;
 delete from public.articles where id=(select id from scope_test_ids where kind='own');get diagnostics n=row_count;if n<>0 then raise exception 'Published deletion allowed without unpublish';end if;
 delete from public.articles where id=(select id from scope_test_ids where kind='foreign');get diagnostics n=row_count;if n<>0 then raise exception 'Foreign deletion allowed';end if;
 update public.articles set status='ready' where id=(select id from scope_test_ids where kind='own');
 delete from public.articles where id=(select id from scope_test_ids where kind='own');get diagnostics n=row_count;if n<>1 then raise exception 'Own unpublished deletion blocked';end if;
 insert into public.articles(id,title,body,section,category,status,author_id)
 select id,'Allowed own published insert','Synthetic insert','news','iraq','published',auth.uid() from scope_test_ids where kind='new';
 denied:=false;begin insert into public.articles(title,body,section,category,status,author_id) values('Incomplete report','Test body','report','iraq','published',auth.uid());exception when raise_exception then denied:=true;end;if not denied then raise exception 'Missing source checklist bypassed';end if;
end $test$;
-- Existing owner still requires MFA. Failure would mean the scoped exception leaked.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.own_scope_owner'),'role','authenticated','aal','aal1')::text,true);
do $test$declare denied boolean:=false;begin
 begin update public.articles set status='published' where id=(select id from scope_test_ids where kind='foreign');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Owner MFA requirement bypassed';end if;
end $test$;
reset role;
update public.profiles set own_article_publisher=false where id=current_setting('test.own_scope_subject')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.own_scope_subject'),'role','authenticated','aal','aal2')::text,true);
do $test$declare denied boolean:=false;n integer;begin
 begin update public.articles set status='published' where id=(select id from scope_test_ids where kind='foreign');exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Unflagged editor unexpectedly gained publication';end if;
 delete from public.articles where id=(select id from scope_test_ids where kind='foreign');get diagnostics n=row_count;if n<>0 then raise exception 'Unflagged editor gained deletion';end if;
end $test$;
rollback;
select 'PASS: own create/edit/publish/unpublish/delete; foreign rows and ownership changes denied; translation isolation; checklist and Owner MFA preserved. All fixtures rolled back.' as verification;
