#!/usr/bin/env bash
set -euo pipefail
umask 077
# Never enable shell tracing: connection and storage credentials are secrets.
required=(PGDATABASE BACKUP_AGE_RECIPIENT SOURCE_S3_ENDPOINT SOURCE_S3_REGION SOURCE_S3_ACCESS_KEY SOURCE_S3_SECRET_KEY B2_ENDPOINT B2_REGION B2_BUCKET B2_ARCHIVE_BUCKET B2_ACCESS_KEY B2_SECRET_KEY)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then echo "Missing required configuration: $name" >&2; exit 1; fi
done
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/payload/storage"
export PGSSLMODE=require
image=postgres:17.6
docker run --rm -e PGDATABASE -e PGSSLMODE "$image" pg_dump --format=custom > "$work/payload/database.dump"
docker run --rm -i "$image" pg_restore --list < "$work/payload/database.dump" > /dev/null
# Global role definitions without passwords; preserve grants in the database dump.
docker run --rm -e PGDATABASE -e PGSSLMODE "$image" sh -c 'pg_dumpall --dbname="$PGDATABASE" --roles-only --no-role-passwords' > "$work/payload/roles.sql"
docker run --rm -e PGDATABASE -e PGSSLMODE "$image" psql -XAt -v ON_ERROR_STOP=1 -c "SELECT coalesce(json_agg(row_to_json(b)), '[]'::json) FROM storage.buckets b" > "$work/payload/buckets.json"
docker run --rm -e PGDATABASE -e PGSSLMODE "$image" psql -XAt -v ON_ERROR_STOP=1 -c "SELECT coalesce(json_agg(row_to_json(o)), '[]'::json) FROM storage.objects o" > "$work/payload/objects.json"
export AWS_ACCESS_KEY_ID="$SOURCE_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$SOURCE_S3_SECRET_KEY" AWS_DEFAULT_REGION="$SOURCE_S3_REGION"
python3 - "$work/payload/buckets.json" "$work/payload/storage" <<'PY'
import json, os, pathlib, subprocess, sys
root = pathlib.Path(sys.argv[2]).resolve()
for bucket in json.load(open(sys.argv[1])):
    dest = (root / bucket['id']).resolve()
    if not dest.is_relative_to(root) or dest == root:
        raise ValueError('Unsafe bucket identifier')
    subprocess.run(['aws','--endpoint-url',os.environ['SOURCE_S3_ENDPOINT'],'s3','sync',
                    's3://' + bucket['id'], str(dest), '--only-show-errors'], check=True)
PY
docker run --rm -e PGDATABASE -e PGSSLMODE "$image" psql -XAt -v ON_ERROR_STOP=1 -c "SELECT coalesce(json_agg(row_to_json(a)), '[]'::json) FROM public.articles a" > "$work/payload/articles.json"
docker run --rm -e PGDATABASE -e PGSSLMODE "$image" psql -XAt -v ON_ERROR_STOP=1 -c "SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM public.article_translations t" > "$work/payload/translations.json"
docker run --rm -e PGDATABASE -e PGSSLMODE "$image" psql -XAt -v ON_ERROR_STOP=1 -c "SELECT coalesce(json_agg(row_to_json(r)), '[]'::json) FROM newsroom_private.content_revisions r" > "$work/payload/revisions.json"
# Validate the actual bytes against the database's object inventory; abort on omissions.
python3 scripts/backup-package.py "$work/payload" "$work/backup.zip"
python3 scripts/backup-verify.py "$work/backup.zip"
age -r "$BACKUP_AGE_RECIPIENT" -o "$work/backup.zip.age" "$work/backup.zip"
digest=$(sha256sum "$work/backup.zip.age" | cut -d ' ' -f1)
key="alnuqta-backups/$(date -u +%Y/%m/%d)/$(date -u +%Y%m%dT%H%M%SZ)-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}.zip.age"
until_date=$(date -u -d '+30 days' +%Y-%m-%dT%H:%M:%SZ)
export AWS_ACCESS_KEY_ID="$B2_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$B2_SECRET_KEY" AWS_DEFAULT_REGION="$B2_REGION"
aws --endpoint-url "$B2_ENDPOINT" s3api put-object --bucket "$B2_BUCKET" --key "$key" --body "$work/backup.zip.age" --metadata "sha256=$digest" --object-lock-mode COMPLIANCE --object-lock-retain-until-date "$until_date" > "$work/upload.json"
version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["VersionId"])' "$work/upload.json")
aws --endpoint-url "$B2_ENDPOINT" s3api get-object-retention --bucket "$B2_BUCKET" --key "$key" --version-id "$version" > "$work/retention.json"
python3 - "$work/retention.json" "$until_date" <<'PY'
import json, sys
from datetime import datetime
r = json.load(open(sys.argv[1]))['Retention']
assert r['Mode'] == 'COMPLIANCE'
assert datetime.fromisoformat(r['RetainUntilDate'].replace('Z','+00:00')) >= datetime.fromisoformat(sys.argv[2].replace('Z','+00:00'))
PY
aws --endpoint-url "$B2_ENDPOINT" s3api get-object --bucket "$B2_BUCKET" --key "$key" --version-id "$version" "$work/roundtrip.age" > /dev/null
[[ "$(sha256sum "$work/roundtrip.age" | cut -d ' ' -f1)" == "$digest" ]]
echo "Encrypted ZIP upload, 30-day Compliance lock and download checksum verified."
python3 scripts/backup-preserve.py "$work/payload"
echo "This is not a full restore test."
