"""Offline integrity tests; no network, credentials or live data."""
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

pack = module('pack', 'backup-package.py')
check = module('check', 'backup-verify.py')
preserve = module('preserve', 'backup-preserve.py')
external = module('external', 'backup-external-media.py')

class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'payload'
        self.root.mkdir()
        for name in check.REQUIRED:
            (self.root / name).write_bytes(b'[]' if name.endswith('.json') else b'test')
        self.zip = Path(self.temp.name) / 'backup.zip'
    def make(self):
        pack.package(self.root, self.zip)
    def rewrite(self, transform):
        with zipfile.ZipFile(self.zip) as z:
            records = [(x.filename, z.read(x)) for x in z.infolist()]
        with zipfile.ZipFile(self.zip, 'w') as z:
            for name, data in records:
                name, data = transform(name, data)
                z.writestr(name, data)
    def test_key_rotation_does_not_reuse_lost_key_records(self):
        old = preserve.preservation_prefix('old-test-recipient')
        new = preserve.preservation_prefix('new-test-recipient')
        record = 'articles/same-content-hash.age'
        self.assertNotEqual(old, new)
        self.assertFalse((new + record).startswith(old))
        self.assertEqual(new, preserve.preservation_prefix('new-test-recipient'))
        self.assertTrue(new.startswith('editorial/key-'))
    def test_roundtrip_and_repackage(self):
        self.make()
        self.assertEqual(check.verify(self.zip), len(check.REQUIRED))
        self.make()
        self.assertEqual(check.verify(self.zip), len(check.REQUIRED))
    def test_corruption_rejected(self):
        self.make()
        self.rewrite(lambda n,b: (n, b'evil' if n == 'database.dump' else b))
        with self.assertRaises(ValueError): check.verify(self.zip)
    def test_missing_media_rejected(self):
        (self.root/'objects.json').write_text(json.dumps([{'bucket_id':'newsroom-media','name':'missing.jpg','metadata':{'size':4}}]))
        with self.assertRaises(ValueError): self.make()
    def test_media_roundtrip(self):
        image = self.root/'storage'/'newsroom-media'/'photo.jpg'
        image.parent.mkdir(parents=True)
        image.write_bytes(b'photo')
        (self.root/'objects.json').write_text(json.dumps([{'bucket_id':'newsroom-media','name':'photo.jpg','metadata':{'size':5}}]))
        self.make()
        self.assertEqual(check.verify(self.zip),len(check.REQUIRED)+1)
    def test_unsafe_path_rejected(self):
        self.make()
        self.rewrite(lambda n,b: ('../database.dump' if n=='database.dump' else n,b))
        with self.assertRaises(ValueError): check.verify(self.zip)
    def test_unlisted_entry_rejected(self):
        self.make()
        with zipfile.ZipFile(self.zip,'a') as z: z.writestr('unexpected',b'bad')
        with self.assertRaises(ValueError): check.verify(self.zip)
    def test_symlink_rejected(self):
        (self.root/'unsafe').symlink_to(self.root/'database.dump')
        with self.assertRaises(ValueError): self.make()
    def test_output_inside_payload_rejected(self):
        with self.assertRaises(ValueError): pack.package(self.root,self.root/'backup.zip')
    def test_external_images_archive_roundtrip_and_preservation(self):
        (self.root/'articles.json').write_text(json.dumps([{'id':'example','image':'https://images.pexels.com/a'}]))
        report=external.collect(self.root, lambda url: (b'image-bytes','image/jpeg'))
        self.assertTrue(report['complete_for_scope'])
        self.make()
        self.assertEqual(check.verify(self.zip),len(check.REQUIRED)+2)
        records=list(preserve.records(self.root))
        self.assertTrue(any(k=='external-media-metadata' for k,v in records))
        image=self.root/report['records'][0]['path']
        image.write_bytes(b'changed')
        with self.assertRaises(ValueError): list(preserve.records(self.root))
    def test_external_failure_is_not_silently_complete(self):
        (self.root/'articles.json').write_text(json.dumps([{'id':'example','image':'https://images.pexels.com/a'}]))
        def fail(url): raise TimeoutError()
        report=external.collect(self.root,fail)
        self.assertFalse(report['complete_for_scope'])
        self.assertFalse(report['records'][0]['captured'])
    def test_external_origins_and_redirects_are_restricted(self):
        for url in ['http://images.pexels.com/a','https://127.0.0.1/a','https://images.pexels.com@localhost/a']:
            with self.assertRaises(ValueError): external.download(url)
        self.assertIsNone(external.NoRedirect().redirect_request(None,None,302,'',{},'https://localhost'))
    def test_gallery_credit_and_duplicate_references(self):
        refs=external.references([{'id':'a','image':'https://images.pexels.com/a','cover_image_url':'https://images.pexels.com/a','cover_image_credit':'cover','gallery':[{'url':'https://images.pexels.com/b','credit':'gallery'}]}])
        self.assertEqual(len(refs['https://images.pexels.com/a']),1)
        self.assertEqual(refs['https://images.pexels.com/b'][0]['source_metadata']['credit'],'gallery')

if __name__=='__main__':
    unittest.main()
