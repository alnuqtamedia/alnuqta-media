import os, sys, logging
logging.disable(logging.CRITICAL)
from b2sdk.v2 import B2Api, InMemoryAccountInfo
try:
    api = B2Api(InMemoryAccountInfo())
    api.authorize_account('production', os.environ['B2_SETUP_KEY_ID'].strip(), os.environ['B2_SETUP_KEY'].strip())
    print('Official Backblaze SDK authentication succeeded; no key created.')
except Exception as error:
    print('Official SDK authentication failed: ' + type(error).__name__, file=sys.stderr)
    sys.exit(1)
