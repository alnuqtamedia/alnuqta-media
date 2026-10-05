"""Exercise production publication triggers only in a networkless disposable database."""
import importlib.util,json,os,subprocess,tempfile,time,uuid
from pathlib import Path
spec=importlib.util.spec_from_file_location('rehearse',Path(__file__).with_name('backup-rehearse.py'))
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
run=r.run
name='alnuqta-security-test-'+uuid.uuid4().hex
try:
 os.environ['PGOPTIONS']='-c default_transaction_read_only=on'
 os.environ['PGSSLMODE']='require';os.environ['PGCONNECT_TIMEOUT']='20'
 source=['docker','run','--rm','-e','PGDATABASE','-e','PGOPTIONS','-e','PGSSLMODE','-e','PGCONNECT_TIMEOUT',r.IMAGE,'sh','-c']
 run(['docker','pull',r.IMAGE],timeout=240)
 sql="SELECT json_build_object('functions',(SELECT json_agg(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('enforce_article_publish_integrity','enforce_article_workflow')),'triggers',(SELECT json_agg(pg_get_triggerdef(t.oid)) FROM pg_trigger t WHERE t.tgrelid='public.articles'::regclass AND t.tgname IN ('enforce_article_publish_integrity_trigger','enforce_article_workflow_trigger')));"
 config=json.loads(run(source+['exec psql --dbname="$PGDATABASE" -XqAtw -v ON_ERROR_STOP=1 -c "$1"','sh',sql]))
 if len(config['functions'])!=2 or len(config['triggers'])!=2: raise ValueError('Required guards missing')
 run(['docker','run','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust',r.IMAGE])
 for _ in range(45):
  if subprocess.run(['docker','exec',name,'pg_isready','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
  time.sleep(1)
 else:raise ValueError('Destination unavailable')
 def execute(text):return run(['docker','exec','-i',name,'psql','-U','postgres','-XqAt','-v','ON_ERROR_STOP=1'],input=text.encode())
 setup="""CREATE SCHEMA auth;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('aal',current_setting('test.aal',true)) $$;
 CREATE FUNCTION public.current_user_role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
 CREATE TABLE public.articles(id int PRIMARY KEY,status text,title text,body text,category text,section text,sources jsonb,videos jsonb,cover_image_url text,image text,cover_image_credit text,published_at timestamptz);
 """+';\n'.join(config['functions'])+';\n'+';\n'.join(config['triggers'])+';'
 execute(setup)
 cases=[('owner_aal2_insert','owner','aal2',True,False),('owner_aal1_insert','owner','aal1',False,False),('editor_aal2_insert','editor','aal2',False,False),('writer_aal2_insert','writer','aal2',False,False),('editor_aal2_update','editor','aal2',False,True),('writer_aal2_update','writer','aal2',False,True),('owner_aal2_update','owner','aal2',True,True)]
 failures=[]
 for label,role,aal,allowed,update in cases:
  action="UPDATE public.articles SET status='published' WHERE id=1;" if update else "INSERT INTO public.articles VALUES(1,'published','Test title','Test body','news','news','[]','[]',NULL,NULL,NULL,NULL);"
  seed="INSERT INTO public.articles VALUES(1,'draft','Test title','Test body','news','news','[]','[]',NULL,NULL,NULL,NULL);" if update else ''
  test="BEGIN; SELECT set_config('test.role','owner',true); SELECT set_config('test.aal','aal2',true); "+seed+" SELECT set_config('test.role','"+role+"',true); SELECT set_config('test.aal','"+aal+"',true); DO $test$ DECLARE succeeded boolean:=true; BEGIN BEGIN "+action+" EXCEPTION WHEN OTHERS THEN succeeded:=false; END; IF succeeded IS DISTINCT FROM "+str(allowed).lower()+" THEN RAISE EXCEPTION 'GUARD_MISMATCH'; END IF; END $test$; ROLLBACK;"
  try:execute(test);print('PASS '+label,flush=True)
  except RuntimeError:failures.append(label);print('FAIL '+label+' expected_permission='+str(allowed).lower(),flush=True)
 print('SCOPE: exact current trigger/function definitions; mocked role/JWT; isolated database; no source writes. Not a full RLS/Auth or frozen archive restore.',flush=True)
 if failures:raise SystemExit(1)
finally:
 subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)
