begin;
insert into public.article_translations(article_id,title,body,source_updated_at)
select id,'RLS test','Test only',updated_at from public.articles where status='published' order by id limit 1;
set local role anon;
do $$ begin if exists(select 1 from public.article_translations where title='RLS test') then raise exception 'Draft exposed'; end if; end $$;
reset role;
update public.article_translations set status='published' where title='RLS test';
set local role anon;
do $$ begin if not exists(select 1 from public.article_translations where title='RLS test') then raise exception 'Published hidden'; end if; end $$;
reset role;
update public.article_translations set source_updated_at=source_updated_at-interval '1 second' where title='RLS test';
set local role anon;
do $$ begin if exists(select 1 from public.article_translations where title='RLS test') then raise exception 'Stale exposed'; end if; end $$;
reset role;
update public.article_translations set status='draft' where title='RLS test';
select set_config('test.owner_id',(select id::text from public.profiles where role='owner' order by id limit 1),true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner_id'),'role','authenticated','aal','aal1')::text,true);
do $$ begin
 begin update public.article_translations set status='published' where title='RLS test'; raise exception 'AAL1 publish permitted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner_id'),'role','authenticated','aal','aal2')::text,true);
do $$ declare n integer; begin update public.article_translations set status='published' where title='RLS test'; get diagnostics n=row_count;if n<>1 then raise exception 'Owner AAL2 publish failed';end if;end $$;
reset role;
rollback;
select 'PASS: draft hidden, published visible, stale hidden, AAL1 denied, owner AAL2 allowed; test data rolled back' as result;
