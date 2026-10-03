"""Verify a decrypted backup ZIP before any restore. Does not extract or mutate data."""
import hashlib
import json
import sys
import zipfile
from pathlib import PurePosixPath

REQUIRED = {'database.dump', 'roles.sql', 'buckets.json', 'objects.json', 'articles.json', 'translations.json', 'revisions.json'}

def verify(path):
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        names = [item.filename for item in entries]
        if len(names) != len(set(names)):
            raise ValueError('Duplicate ZIP entries')
        for item in entries:
            name = item.filename
            parts = PurePosixPath(name).parts
            if not name or name.startswith('/') or '\\' in name or '..' in parts or ':' in parts[0] or item.is_dir():
                raise ValueError('Unsafe ZIP path')
            if ((item.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError('ZIP symlinks are forbidden')
        if not REQUIRED.issubset(names) or 'manifest.json' not in names:
            raise ValueError('Required backup files missing')
        manifest_info = archive.getinfo('manifest.json')
        if manifest_info.file_size > 64 * 1024 * 1024:
            raise ValueError('Manifest too large')
        def unique_pairs(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError('Duplicate manifest key')
                result[key] = value
            return result
        manifest = json.loads(archive.read('manifest.json'), object_pairs_hook=unique_pairs)
        if set(manifest) != set(names) - {'manifest.json'}:
            raise ValueError('Manifest and ZIP inventory differ')
        for name, expected in manifest.items():
            info = archive.getinfo(name)
            if info.file_size != expected['bytes']:
                raise ValueError('File size mismatch')
            with archive.open(name) as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            if digest != expected['sha256']:
                raise ValueError('SHA256 mismatch')
        # Confirm every recorded Storage object has actual bytes in the archive.
        objects = json.loads(archive.read('objects.json'))
        for obj in objects:
            name = 'storage/' + obj['bucket_id'] + '/' + obj['name']
            if name not in manifest:
                raise ValueError('Storage object missing')
            expected = (obj.get('metadata') or {}).get('size')
            if expected is not None and manifest[name]['bytes'] != int(expected):
                raise ValueError('Storage metadata size mismatch')
        return len(manifest)

if __name__ == '__main__':
    try:
        count = verify(sys.argv[1])
        print(f'PASS: {count} files verified. No extraction or database restore performed.')
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, IndexError):
        print('FAIL: backup verification failed; do not restore this archive.', file=sys.stderr)
        sys.exit(1)
