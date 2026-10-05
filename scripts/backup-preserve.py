"""Append encrypted content-addressed editorial records/media to a separate bucket.

No delete/sync-delete operation exists. An existing hash-addressed object is reused.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


def records(root):
    for kind, filename in [('articles', 'articles.json'), ('translations', 'translations.json'),
                           ('revisions', 'revisions.json'), ('storage-metadata', 'objects.json'),
                           ('buckets', 'buckets.json')]:
        for record in json.loads((root / filename).read_text()):
            yield kind, json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    for path in sorted((root / 'storage').rglob('*')):
        if path.is_file():
            yield 'media', path


def sha256(value):
    if isinstance(value, Path):
        with value.open('rb') as stream:
            return hashlib.file_digest(stream, 'sha256').hexdigest()
    return hashlib.sha256(value).hexdigest()


def preservation_prefix(recipient):
    # Deduplicate only within a recipient generation; old keys may be unrecoverable.
    return 'editorial/key-' + hashlib.sha256(recipient.encode('ascii')).hexdigest() + '/'


def preserve(root):
    bucket = os.environ['B2_ARCHIVE_BUCKET']
    if bucket == os.environ['B2_BUCKET']:
        raise ValueError('Preservation must use a separate bucket without expiry rules')
    base = ['aws', '--endpoint-url', os.environ['B2_ENDPOINT'], '--output', 'json', 's3api']
    prefix = preservation_prefix(os.environ['BACKUP_AGE_RECIPIENT'])
    listing = json.loads(subprocess.check_output(base + ['list-objects-v2', '--bucket', bucket, '--prefix', prefix]))
    known = {item['Key'] for item in listing.get('Contents', [])}
    count = 0
    reused = 0
    with tempfile.TemporaryDirectory() as directory:
        plain = Path(directory) / 'record'
        encrypted = Path(directory) / 'record.age'
        roundtrip = Path(directory) / 'roundtrip.age'
        for kind, value in records(root):
            key = f'{prefix}{kind}/{sha256(value)}.age'
            if key in known:
                head = json.loads(subprocess.check_output(base + ['head-object', '--bucket', bucket, '--key', key]))
                version = head['VersionId']
                digest = head.get('Metadata', {}).get('sha256', '')
                retention = json.loads(subprocess.check_output(base + ['get-object-retention', '--bucket', bucket,
                    '--key', key, '--version-id', version]))['Retention']
                if retention.get('Mode') != 'COMPLIANCE' or datetime.fromisoformat(retention['RetainUntilDate'].replace('Z', '+00:00')) <= datetime.now(timezone.utc):
                    raise ValueError('Existing preservation object is not under an active Compliance lock')
                subprocess.run(base + ['get-object', '--bucket', bucket, '--key', key, '--version-id', version,
                    str(roundtrip)], check=True, stdout=subprocess.DEVNULL)
                if not digest or sha256(roundtrip) != digest:
                    raise ValueError('Existing preservation roundtrip mismatch')
                reused += 1
                continue
            source = value if isinstance(value, Path) else plain
            if not isinstance(value, Path):
                plain.write_bytes(value)
            encrypted.unlink(missing_ok=True)
            subprocess.run(['age', '-r', os.environ['BACKUP_AGE_RECIPIENT'], '-o', str(encrypted), str(source)], check=True)
            digest = sha256(encrypted)
            until = (datetime.now(timezone.utc) + timedelta(days=365, seconds=1)).replace(microsecond=0).isoformat()
            result = json.loads(subprocess.check_output(base + ['put-object', '--bucket', bucket, '--key', key,
                '--body', str(encrypted), '--metadata', 'sha256=' + digest, '--object-lock-mode', 'COMPLIANCE',
                '--object-lock-retain-until-date', until]))
            version = result['VersionId']
            retention = json.loads(subprocess.check_output(base + ['get-object-retention', '--bucket', bucket,
                '--key', key, '--version-id', version]))['Retention']
            if retention['Mode'] != 'COMPLIANCE' or datetime.fromisoformat(retention['RetainUntilDate'].replace('Z', '+00:00')) < datetime.fromisoformat(until):
                raise ValueError('Preservation lock verification failed: requested=' + until + '; actual=' + str(retention))
            subprocess.run(base + ['get-object', '--bucket', bucket, '--key', key, '--version-id', version,
                str(roundtrip)], check=True, stdout=subprocess.DEVNULL)
            if sha256(roundtrip) != digest:
                raise ValueError('Preservation roundtrip mismatch')
            known.add(key)
            count += 1
    print(f'Preservation: {count} new encrypted objects verified; {reused} existing objects reverified; no deletion performed.')


if __name__ == '__main__':
    preserve(Path(sys.argv[1]).resolve())
