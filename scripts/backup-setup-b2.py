"""Provision a no-delete B2 key and seal it directly into GitHub environment secrets.
Never prints credentials; no production backup is enabled.
"""
import base64, json, os, re, sys
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from urllib.error import HTTPError
from nacl.public import PublicKey, SealedBox

CAPS = ['listFiles', 'readFiles', 'writeFiles', 'readFileRetentions', 'writeFileRetentions']
REPO = 'alnuqtamedia/alnuqta-media'
ENV = 'Backblaze'
STAGE = 'configuration'

def request(url, token, data=None, method=None):
    headers = {'Authorization': token, 'User-Agent': 'alnuqta-backup-setup',
               'Accept': 'application/json'}
    if url.startswith('https://api.github.com/'):
        headers['X-GitHub-Api-Version'] = '2022-11-28'
    raw = None if data is None else json.dumps(data).encode()
    if raw is not None:
        headers['Content-Type'] = 'application/json'
    with urlopen(Request(url, data=raw, headers=headers, method=method), timeout=30) as response:
        body = response.read()
        return json.loads(body) if body else {}

def main():
    global STAGE
    required = ['B2_SETUP_KEY_ID', 'B2_SETUP_KEY', 'BACKUP_SETUP_GITHUB_TOKEN',
                'B2_EMERGENCY_BUCKET_ID', 'B2_PRESERVATION_BUCKET_ID']
    for name in required:
        if not os.environ.get(name):
            raise ValueError('Missing configuration')
    buckets = [os.environ['B2_EMERGENCY_BUCKET_ID'], os.environ['B2_PRESERVATION_BUCKET_ID']]
    if len(set(buckets)) != 2 or not all(re.fullmatch(r'[a-zA-Z0-9]+', b) for b in buckets):
        raise ValueError('Two distinct bucket IDs required')
    gh = 'Bearer ' + os.environ['BACKUP_SETUP_GITHUB_TOKEN']
    target = 'https://api.github.com/repos/' + REPO + '/environments/' + ENV + '/secrets'
    STAGE = 'github-public-key'
    public = request(target + '/public-key', gh)
    # Fail before creating a B2 key if either destination secret already exists.
    STAGE = 'github-secret-inventory'
    existing = request(target + '?per_page=100', gh)
    if existing.get('total_count', 0) > 100:
        raise ValueError('Secret inventory too large')
    if {'B2_ACCESS_KEY', 'B2_SECRET_KEY'} & {s['name'] for s in existing['secrets']}:
        raise ValueError('Refusing to replace existing B2 credentials')
    auth = base64.b64encode((os.environ['B2_SETUP_KEY_ID'] + ':' + os.environ['B2_SETUP_KEY']).encode()).decode()
    STAGE = 'b2-authorization'
    account = request('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', 'Basic ' + auth)
    storage = account['apiInfo']['storageApi']
    api = storage['apiUrl']
    parsed = urlparse(api)
    if parsed.scheme != 'https' or not re.fullmatch(r'api[0-9]+[.]backblazeb2[.]com', parsed.netloc):
        raise ValueError('Unexpected API host')
    STAGE = 'b2-create-key'
    result = request(api + '/b2api/v4/b2_create_key', account['authorizationToken'],
                     {'accountId': account['accountId'], 'capabilities': CAPS,
                      'keyName': 'alnuqta-backup-no-delete', 'bucketIds': buckets})
    print('::add-mask::' + result['applicationKey'])
    if set(result['capabilities']) != set(CAPS) or set(result['bucketIds']) != set(buckets):
        raise ValueError('Unexpected key scope; revoke the new key in B2')
    seal = SealedBox(PublicKey(base64.b64decode(public['key'])))
    for name, value in [('B2_SECRET_KEY', result['applicationKey']), ('B2_ACCESS_KEY', result['applicationKeyId'])]:
        STAGE = 'github-save-' + name
        request(target + '/' + name, gh,
                {'encrypted_value': base64.b64encode(seal.encrypt(value.encode())).decode(),
                 'key_id': public['key_id']}, 'PUT')
    print('B2 key created with exact no-delete scope; both environment secrets saved.')
    print('Backup remains disabled. Revoke temporary setup credentials before testing backups.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never print exceptions or response bodies containing credential values.
        code = str(error.code) if isinstance(error, HTTPError) else type(error).__name__
        print('Failure stage: ' + STAGE + '; status: ' + code, file=sys.stderr)
        print('Setup failed. Inspect B2 for a partially created key before retrying; no automatic retry.', file=sys.stderr)
        sys.exit(1)
