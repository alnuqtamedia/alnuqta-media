"""Verify/extract a decrypted roundtrip archive and restore editorial data offline."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import uuid
import zipfile

def load(filename):
    spec=importlib.util.spec_from_file_location(filename,Path(__file__).with_name(filename+'.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

verify=load('backup-verify').verify
rehearsal=load('backup-rehearse')
run=rehearsal.run
selected_toc=rehearsal.selected_toc
canonical_rows=rehearsal.canonical_rows
IMAGE=rehearsal.IMAGE
TABLES=rehearsal.TABLES
import hashlib

def restore(root):
    expected={table:json.loads((root/filename).read_text()) for table,filename in [('articles','articles.json'),('article_translations','translations.json'),('content_revisions','revisions.json')]}
    name='alnuqta-archive-restore-'+uuid.uuid4().hex
    started=time.monotonic()
    stage='start'
    try:
        stage = 'select-editorial-objects'
        toc = run(['docker', 'run', '--rm', '-i', '--network', 'none', IMAGE,
                   'pg_restore', '--list'], input=(root / 'database.dump').read_bytes()).decode()
        (root / 'restore.list').write_text(selected_toc(toc))
        stage = 'start-isolated-destination'
        run(['docker', 'run', '-d', '--name', name, '--network', 'none',
             '--tmpfs', '/var/lib/postgresql/data:rw,size=512m',
             '--tmpfs', '/tmp:rw,size=256m', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
             IMAGE])
        for attempt in range(60):
            ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('Destination startup timeout')
        run(['docker', 'exec', name, 'psql', '-U', 'postgres', '-Xq', '-v', 'ON_ERROR_STOP=1',
             '-c', 'CREATE SCHEMA newsroom_private;'])
        stage = 'stream-and-verify-private-files'
        # docker cp cannot write into tmpfs reliably. Stream through the
        # container process, then verify the actual bytes before restore.
        for filename in ('database.dump', 'restore.list'):
            value = (root / filename).read_bytes()
            run(['docker', 'exec', '-i', name, 'sh', '-c',
                 'umask 077; cat > "$1"', 'sh', '/tmp/' + filename], input=value)
            digest = run(['docker', 'exec', name, 'sha256sum', '/tmp/' + filename]).decode().split()[0]
            if digest != hashlib.sha256(value).hexdigest():
                raise ValueError('Temporary file transfer integrity failed')
        stage = 'restore-editorial-tables'
        run(['docker', 'exec', name, 'pg_restore', '-U', 'postgres', '-d', 'postgres',
             '--exit-on-error', '--single-transaction', '--no-owner', '--no-acl',
             '--use-list=/tmp/restore.list', '/tmp/database.dump'])
        stage = 'compare-complete-editorial-rows'
        for schema, table in TABLES:
            raw = run(['docker', 'exec', name, 'psql', '-U', 'postgres', '-XqAt',
                       '-v', 'ON_ERROR_STOP=1', '-c',
                       "SET timezone='UTC'; SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM "
                       + schema + '.' + table + ' t;'])
            actual = json.loads(raw)
            if canonical_rows(actual) != canonical_rows(expected[table]):
                raise ValueError('Restored rows do not match the source snapshot')
            print('PASS ' + table + ': ' + str(len(actual)) + ' complete rows matched', flush=True)
        print('DOWNLOADED_ARCHIVE_EDITORIAL_RESTORE_OK: encrypted roundtrip; networkless temporary PostgreSQL; '
              'elapsed_seconds=' + str(round(time.monotonic() - started)), flush=True)
        print('NOT_TESTED: managed Supabase, RLS/ACL, Auth/MFA, '
              'Vault secrets, Storage service or full website recovery.', flush=True)
    except Exception:
        print('ARCHIVE_RESTORE_FAILED_STAGE='+stage+'; private data suppressed',flush=True)
        raise SystemExit(1)
    finally:
        subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)

if __name__=='__main__':
    os.umask(0o077)
    verify(sys.argv[1])
    with tempfile.TemporaryDirectory() as work:
        with zipfile.ZipFile(sys.argv[1]) as archive:archive.extractall(work)
        root=Path(work)
        coverage=json.loads((root/'external-media.json').read_text())
        if not coverage['complete_for_scope']:raise SystemExit('External image coverage incomplete')
        for record in coverage['records']:
            path=(root/record['path']).resolve()
            if not path.is_relative_to((root/'external-media').resolve()):raise SystemExit('Unsafe media path')
            if hashlib.sha256(path.read_bytes()).hexdigest()!=record['sha256']:raise SystemExit('External image checksum mismatch')
        print('PASS restored external image bytes: '+str(len(coverage['records'])),flush=True)
        restore(root)
