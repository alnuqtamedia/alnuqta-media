"""Collect external editorial image bytes without changing articles or forwarding secrets."""
import hashlib
import json
import sys
import math
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HOSTS = {'upload.wikimedia.org', 'thumb.wikimedia.org', 'images.pexels.com',
         'd1ldvf68ux039x.cloudfront.net', 'assets.the-afc.com',
         't1100310000009723.p.clickup-attachments.com'}
LIMIT = 20 * 1024 * 1024
USER_AGENT = 'AlnuqtaMediaArchiveBot/1.1 (+https://alnuqtamedia.com)'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def references(articles):
    found = {}
    for article in articles:
        cover = {'credit': article.get('cover_image_credit'), 'caption': article.get('cover_image_caption')}
        values = [(article.get('image'), cover), (article.get('cover_image_url'), cover)]
        values += [(x.get('url'), dict(x)) for x in article.get('gallery', []) if isinstance(x, dict)]
        for url, source_metadata in values:
            if not isinstance(url, str) or not url:
                continue
            parsed = urllib.parse.urlsplit(url)
            if parsed.hostname == 'zsqvmuqlmtnhndwuqlfy.supabase.co' and parsed.path.startswith('/storage/v1/object/public/'):
                continue
            reference = {'article_id': article.get('id'), 'source_metadata': source_metadata}
            group = found.setdefault(url, [])
            if reference not in group:
                group.append(reference)
    return found

def retry_delay(headers, now=None):
    value = headers.get('Retry-After')
    if value is None:
        return 30
    try:
        delay = int(value)
    except (ValueError, TypeError):
        try:
            target = parsedate_to_datetime(value)
            if target.tzinfo is None:
                target = target.replace(tzinfo=timezone.utc)
            delay = math.ceil((target - (now or datetime.now(timezone.utc))).total_seconds())
        except (ValueError, TypeError, OverflowError):
            return None
    # A longer provider cooldown is never shortened to fit this job.
    return max(1, delay) if delay <= 45 else None

def download_once(url):
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'https' or parsed.hostname not in HOSTS or
        parsed.port not in (None, 443) or parsed.username or parsed.password):
        raise ValueError('Unapproved external image origin')
    opener = urllib.request.build_opener(NoRedirect())
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with opener.open(request, timeout=20) as response:
        if response.headers.get_content_type() not in {'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'}:
            raise ValueError('Unsupported media content type')
        data = response.read(LIMIT + 1)
        if not data or len(data) > LIMIT:
            raise ValueError('External media size limit')
        return data, response.headers.get_content_type()

def download(url):
    try:
        return download_once(url)
    except urllib.error.HTTPError as exc:
        if exc.code not in (429, 503):
            raise
        delay = retry_delay(exc.headers)
        if delay is None:
            raise
        # One bounded, provider-compliant retry; same identity and destination.
        print('Provider cooldown: waiting_seconds=' + str(delay) + '; retry=1_of_1', flush=True)
        time.sleep(delay)
        return download_once(url)

def collect(root, fetch=download):
    root = Path(root)
    media = root / 'external-media'
    media.mkdir(mode=0o700, exist_ok=True)
    refs = references(json.loads((root / 'articles.json').read_text()))
    records = []
    total = 0
    for index, (url, attribution) in enumerate(refs.items()):
        entry = {'url': url, 'references': attribution, 'captured': False}
        try:
            if index >= 100 or total >= 256 * 1024 * 1024:
                raise ValueError('Collection budget exceeded')
            data, mime = fetch(url)
            digest = hashlib.sha256(data).hexdigest()
            path = media / digest
            path.write_bytes(data)
            total += len(data)
            entry.update(captured=True, path='external-media/' + digest,
                         sha256=digest, bytes=len(data), mime=mime)
        except Exception as exc:
            entry.update(error_class=type(exc).__name__, http_status=getattr(exc, 'code', None))
            # Logs reveal only fixed public-provider names and error types,
            # never article identifiers, private paths or signed query strings.
            host = urllib.parse.urlsplit(url).hostname
            print('External image unavailable: provider=' + (host if host in HOSTS else 'unapproved_origin') +
                  '; error=' + type(exc).__name__ + '; status=' + str(getattr(exc, 'code', None)))
        records.append(entry)
    report = {'scope': 'Current article cover/gallery external images only; not embedded body/document/video URLs',
              'complete_for_scope': all(x['captured'] for x in records), 'records': records}
    (root / 'external-media.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print('External images: captured=' + str(sum(x['captured'] for x in records)) +
          '; missing=' + str(sum(not x['captured'] for x in records)))
    return report

if __name__ == '__main__':
    collect(Path(sys.argv[1]).resolve())
