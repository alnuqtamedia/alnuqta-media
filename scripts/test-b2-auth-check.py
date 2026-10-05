"""Offline tests: hostile error responses never appear in diagnostic output."""
import contextlib
import importlib.util
import io
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
spec = importlib.util.spec_from_file_location('auth', 'scripts/b2-sdk-auth-check.py')
auth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auth)

class Tests(unittest.TestCase):
    def test_error_redaction(self):
        for body in (b'{"code":"bad_auth_token","message":"SECRET_KEY authorizationToken"}',
                     b'{"code":"SECRET_KEY","message":"SECRET_ID"}',
                     b'["SECRET_KEY"]', b'SECRET_KEY'):
            with self.subTest(body=body):
                err = HTTPError('https://api.backblazeb2.com',401,'SECRET_KEY',{},io.BytesIO(body))
                out=io.StringIO()
                with patch.object(auth,'build_opener') as opener, contextlib.redirect_stdout(out):
                    opener.return_value.open.side_effect=err
                    self.assertFalse(auth.direct_check('SECRET_ID','SECRET_KEY'))
                self.assertNotIn('SECRET',out.getvalue())
                self.assertIn('http=401',out.getvalue())
    def test_success_body_not_read(self):
        with patch.object(auth,'build_opener') as opener, contextlib.redirect_stdout(io.StringIO()):
            response=opener.return_value.open.return_value.__enter__.return_value
            response.status=200
            self.assertTrue(auth.direct_check('ID','KEY'))
            response.read.assert_not_called()
    def test_no_redirect(self):
        self.assertIsNone(auth.NoRedirect().redirect_request(None,None,302,'',{},'https://other.example'))
    def test_missing_and_invisible(self):
        for value in ('', 'abc\ufeff', 'abc\r\n', '"abc"'):
            with patch.dict(auth.os.environ, {'TEST':value}), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(ValueError): auth.inspect('TEST')
if __name__=='__main__':unittest.main()
