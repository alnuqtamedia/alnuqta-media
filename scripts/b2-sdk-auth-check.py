import os, sys, logging, unicodedata
logging.disable(logging.CRITICAL)
from b2sdk.v2 import B2Api, InMemoryAccountInfo

def inspect(name):
    raw = os.environ.get(name, '')
    value = raw.strip()
    flags = {
        'present': bool(raw),
        'surrounding_whitespace': raw != value,
        'cr_or_lf': any(c in raw for c in '\r\n'),
        'unicode_control_or_format': any(unicodedata.category(c).startswith('C') for c in raw),
        'non_ascii': not raw.isascii(),
        'quote_at_boundary': bool(value) and (value[0] in "'\"" or value[-1] in "'\""),
        'internal_whitespace': any(c.isspace() for c in value),
    }
    print(name + ' shape: ' + ', '.join(k + '=' + str(v).lower() for k, v in flags.items()))
    # Never emit values, fragments, lengths, hashes or exception messages.
    if not value:
        raise ValueError('missing credential')
    if any(flags[k] for k in ('unicode_control_or_format', 'non_ascii', 'quote_at_boundary', 'internal_whitespace')):
        raise ValueError('unexpected credential characters')
    return value

try:
    key_id = inspect('B2_SETUP_KEY_ID')
    key = inspect('B2_SETUP_KEY')
    api = B2Api(InMemoryAccountInfo())
    api.authorize_account('production', key_id, key)
    print('Official Backblaze SDK authentication succeeded; no key created.')
except Exception as error:
    print('Authentication check failed: ' + type(error).__name__, file=sys.stderr)
    sys.exit(1)
