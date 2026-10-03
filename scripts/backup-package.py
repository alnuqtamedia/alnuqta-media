"""Validate Storage inventory, hash payload and create a compressed ZIP64 archive."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path


def package(root, output):
    root = Path(root).resolve()
    for obj in json.loads((root / 'objects.json').read_text()):
        path = (root / 'storage' / obj['bucket_id'] / obj['name']).resolve()
        if not path.is_relative_to(root / 'storage') or not path.is_file():
            raise ValueError('Missing or unsafe Storage object; backup aborted')
        expected = (obj.get('metadata') or {}).get('size')
        if expected is not None and path.stat().st_size != int(expected):
            raise ValueError('Storage object size mismatch; backup aborted')
    manifest = {}
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            raise ValueError('Symlinks are not allowed in backup payload')
        if path.is_file():
            with path.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            manifest[str(path.relative_to(root))] = {'bytes': path.stat().st_size, 'sha256': digest}
    (root / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as archive:
        for path in sorted(root.rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(root))
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError('ZIP integrity check failed')


if __name__ == '__main__':
    package(sys.argv[1], sys.argv[2])
