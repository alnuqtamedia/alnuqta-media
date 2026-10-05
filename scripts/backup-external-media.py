"""Collect external editorial image bytes without changing articles or forwarding secrets."""
import hashlib
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HOSTS = {'upload.wikimedia.org', 'thumb.wikimedia.org', 'images.pexels.com',
         'd1ldvf68ux039x.cloudfront.net', 'assets.the-afc.com'}
LIMIT = 20 * 1024 * 1024

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def references(articles):
    found = {}
    for article in articles:
        values = [article.get('image'), article.get('cover_image_url')]
        values += [x.get('url') for x in article.get('gallery', []) if isinstance(x, dict)]
        for url in values:
            if not isinstance(url, str) or not url:
                continue
            parsed = urllib.parse.urlsplit(url)
            if parsed.hostname == 'zsqvmuqlmtnhndwuqlfy.supabase.co' and parsed.path.startswith('/storage/v1/object/public/'):
                continue
            found.setdefault(url, []).append({'article_id': article.get('id'),
                'credit': article.get('cover_image_credit'), 'caption': article.get('cover_image_caption')})
    return found

def download(url):
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'https' or parsed.hostname not in HOSTS or
        parsed.port not in (None, 443) or parsed.username or parsed.password):
        raise ValueError('Unapproved external image origin')
    opener = urllib.request.build_opener(NoRedirect())
    request = urllib.request.Request(url, headers={'User-Agent': 'AlnuqtaMediaArchive/1.0'})
    with opener.open(request, timeout=20) as response:
        if response.headers.get_content_type() not in {'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'}:
            raise ValueError('Unsupported media content type')
        data = response.read(LIMIT + 1)
        if not data or len(data) > LIMIT:
            raise ValueError('External media size limit')
        return data, response.headers.get_content_type()

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
        records.append(entry)
    report = {'scope': 'Current article cover/gallery external images only; not embedded body/document/video URLs',
              'complete_for_scope': all(x['captured'] for x in records), 'records': records}
    (root / 'external-media.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print('External images: captured=' + str(sum(x['captured'] for x in records)) +
          '; missing=' + str(sum(not x['captured'] for x in records)))
    return report

if __name__ == '__main__':
    collect(Path(sys.argv[1]).resolve())
