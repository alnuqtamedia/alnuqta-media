"""Credential-shape and SDK/direct Native API diagnostics; never emits credentials."""
import base64
import json
import logging
import os
import platform
import sys
import unicodedata
from importlib.metadata import version
from urllib.error import HTTPError
from urllib.request import Request, HTTPRedirectHandler, build_opener

logging.disable(logging.CRITICAL)
SAFE_CODES = frozenset({'unauthorized', 'unsupported', 'bad_request', 'bad_bucket_id',
                       'bad_auth_token', 'expired_auth_token', 'transaction_cap_exceeded',
                       'service_unavailable', 'too_many_requests'})


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
    # No values, fragments, lengths, hashes, headers or arbitrary error messages.
    if not value:
        raise ValueError('missing credential')
    if any(flags[k] for k in ('unicode_control_or_format', 'non_ascii', 'quote_at_boundary', 'internal_whitespace')):
        raise ValueError('unexpected credential characters')
    return value


def safe_status(value):
    return value if type(value) is int and 100 <= value <= 599 else 'unavailable'


def safe_code(value):
    return value if isinstance(value, str) and value in SAFE_CODES else 'unavailable-or-unrecognized'


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def direct_check(key_id, key):
    auth = base64.b64encode((key_id + ':' + key).encode()).decode()
    req = Request('https://api.backblazeb2.com/b2api/v4/b2_authorize_account',
                  headers={'Authorization': 'Basic ' + auth,
                           'User-Agent': 'alnuqta-auth-diagnostics'})
    try:
        # Never follow redirects with a credential-bearing request.
        with build_opener(NoRedirect()).open(req, timeout=20) as response:
            status = response.status
            # Do not print/read a successful response containing an auth token.
        print('direct_native_v4: http=' + str(safe_status(status)))
        return status == 200
    except HTTPError as error:
        payload = {}
        try:
            payload = json.loads(error.read(8192))
        except (ValueError, OSError):
            pass
        if not isinstance(payload, dict):
            payload = {}
        print('direct_native_v4: http=' + str(safe_status(error.code)) +
              ', code=' + safe_code(payload.get('code')) +
              ', provider_message_present=' + str(bool(payload.get('message'))).lower())
        return False
    except Exception:
        print('direct_native_v4: transport_error; details suppressed')
        return False


def main():
    from b2sdk.v2 import B2Api, InMemoryAccountInfo
    print('python=' + platform.python_version() + ', b2sdk=' + version('b2sdk'), flush=True)
    try:
        key_id, key = inspect('B2_SETUP_KEY_ID'), inspect('B2_SETUP_KEY')
    except ValueError:
        print('stage=credential_shape; invalid input; no authentication attempted')
        return 1
    sdk_ok = False
    try:
        B2Api(InMemoryAccountInfo()).authorize_account('production', key_id, key)
        sdk_ok = True
        print('sdk_authorize_account: AUTH_OK')
    except Exception as error:
        print('sdk_authorize_account: exception=' + type(error).__name__ +
              ', http=' + str(safe_status(getattr(error, 'status', None))) +
              ', code=' + safe_code(getattr(error, 'code', None)))
    direct_ok = direct_check(key_id, key)
    print('result: sdk_ok=' + str(sdk_ok).lower() + ', direct_ok=' + str(direct_ok).lower())
    print('No keys created, files uploaded or backup settings changed.')
    return 0 if sdk_ok and direct_ok else 1


if __name__ == '__main__':
    sys.exit(main())
