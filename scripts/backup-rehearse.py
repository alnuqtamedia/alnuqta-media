"""Partial editorial restore of a fresh custom dump; never a full-site restore.

Source connections are read-only. Destination is a unique networkless Docker
container without published ports. No owner age identity is requested or used.
Only counts and stage identifiers may reach public workflow logs.
"""
import json
import os
from pathlib import Path
import re
import selectors
import subprocess
import tempfile
import time
import uuid

IMAGE = 'postgres:17.6'
TABLES = [('public', 'articles'), ('public', 'article_translations'),
          ('newsroom_private', 'content_revisions')]

def selected_toc(text):
    selected = []
    found = set()
    names = set(TABLES) | {('newsroom_private', 'content_revisions_id_seq')}
    pattern = re.compile(r'^\d+; \d+ \d+ (TABLE DATA|SEQUENCE OWNED BY|SEQUENCE SET|TABLE|SEQUENCE|DEFAULT) (\S+) (\S+) ')
    for line in text.splitlines():
        match = pattern.match(line)
        if match and (match[2], match[3]) in names:
            selected.append(line)
            if match[1] == 'TABLE':
                found.add((match[2], match[3]))
    if found != set(TABLES):
        raise ValueError('Required editorial tables missing from dump')
    return '\n'.join(selected) + '\n'

def canonical_rows(rows):
    return sorted(json.dumps(row, ensure_ascii=False, sort_keys=True,
                             separators=(',', ':')) for row in rows)

def run(args, **kw):
    result = subprocess.run(args, stderr=subprocess.PIPE,
                            stdout=kw.pop('stdout', subprocess.PIPE),
                            timeout=kw.pop('timeout', 180), **kw)
    if result.returncode:
        error = result.stderr.decode(errors='replace').lower()
        markers = ('does not exist', 'already exists', 'permission denied', 'read-only',
                   'syntax error', 'not-null', 'foreign key', 'invalid input',
                   'unsupported', 'out of memory', 'no space', 'could not connect',
                   'cannot insert', 'identity', 'sequence', 'schema', 'function',
                   'constraint', 'extension', 'connection refused')
        indicators = ','.join(marker.replace(' ', '_') for marker in markers if marker in error)
        raise RuntimeError('safe_indicators=' + (indicators or 'unclassified'))
    return result.stdout

def main():
    os.umask(0o077)
    if not os.environ.get('PGDATABASE'):
        raise ValueError('Missing source connection')
    os.environ['PGOPTIONS'] = '-c default_transaction_read_only=on -c timezone=UTC'
    os.environ['PGCONNECT_TIMEOUT'] = '20'
    os.environ['PGSSLMODE'] = 'require'
    name = 'alnuqta-rehearsal-' + uuid.uuid4().hex
    snapshot_name = name + '-snapshot'
    snapshot_process = None
    stage = 'pull-client'
    started = time.monotonic()
    source = ['docker', 'run', '--rm', '-e', 'PGDATABASE', '-e', 'PGOPTIONS',
              '-e', 'PGCONNECT_TIMEOUT', '-e', 'PGSSLMODE', IMAGE, 'sh', '-c']
    try:
        run(['docker', 'pull', IMAGE], timeout=240)
        with tempfile.TemporaryDirectory() as work:
            root = Path(work)
            stage = 'open-read-only-snapshot'
            # Hold the exporting transaction while both dump and reference rows
            # are read. A bounded sleep is inside the remote read-only session.
            hold = ['docker', 'run', '--rm', '--name', snapshot_name, '-e', 'PGDATABASE',
                    '-e', 'PGOPTIONS', '-e', 'PGCONNECT_TIMEOUT', '-e', 'PGSSLMODE',
                    IMAGE, 'sh', '-c',
                    'exec psql --dbname="$PGDATABASE" -XqAtw -v ON_ERROR_STOP=1 '
                    '-c "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" '
                    '-c "SELECT pg_export_snapshot()" -c "SELECT pg_sleep(600)"']
            snapshot_process = subprocess.Popen(hold, stdout=subprocess.PIPE,
                                                 stderr=subprocess.DEVNULL)
            selector = selectors.DefaultSelector()
            selector.register(snapshot_process.stdout, selectors.EVENT_READ)
            if not selector.select(45):
                raise RuntimeError('Snapshot timeout')
            snapshot = snapshot_process.stdout.readline().decode().strip()
            selector.close()
            if not re.fullmatch(r'[0-9A-Fa-f]+-[0-9A-Fa-f]+-\d+', snapshot):
                raise ValueError('Snapshot unavailable')
            stage = 'fresh-custom-dump'
            with (root / 'database.dump').open('wb') as output:
                run(source + ['exec pg_dump --dbname="$PGDATABASE" --format=custom --snapshot="$1"',
                              'sh', snapshot], stdout=output, timeout=300)
            expected = {}
            for schema, table in TABLES:
                sql = ("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '"
                       + snapshot + "'; SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM "
                       + schema + '.' + table + ' t; COMMIT;')
                raw = run(source + ['exec psql --dbname="$PGDATABASE" -XqAtw -v ON_ERROR_STOP=1 -c "$1"',
                                    'sh', sql])
                expected[table] = json.loads(raw)
            run(['docker', 'rm', '-f', snapshot_name])
            snapshot_process.wait(timeout=15)
            snapshot_process = None
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
            run(['docker', 'cp', str(root / 'database.dump'), name + ':/tmp/database.dump'])
            run(['docker', 'cp', str(root / 'restore.list'), name + ':/tmp/restore.list'])
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
            print('PARTIAL_EDITORIAL_RESTORE_OK: fresh snapshot; networkless temporary PostgreSQL; '
                  'elapsed_seconds=' + str(round(time.monotonic() - started)), flush=True)
            print('NOT_TESTED: prior encrypted backup, managed Supabase, RLS/ACL, Auth/MFA, '
                  'Vault secrets, Storage service or full website recovery.', flush=True)
    except Exception as exc:
        if isinstance(exc, RuntimeError) and str(exc).startswith('safe_indicators='):
            print(str(exc), flush=True)
        print('REHEARSAL_FAILED_STAGE=' + stage + '; private SQL/data/error output suppressed', flush=True)
        raise SystemExit(1)
    finally:
        for container in (snapshot_name, name):
            subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=30)
        if snapshot_process is not None:
            snapshot_process.wait(timeout=15)

if __name__ == '__main__':
    main()
