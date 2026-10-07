import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Download only the same public configuration delivered to site visitors.
// Never use a service-role/secret key in this file.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public/supabase-public-config.js');
const source = 'https://alnuqtamedia.com/public/supabase-public-config.js';
function validate(text) {
  const match = text.match(/^\s*window\.ALNUQTA_SUPABASE_PUBLIC\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!match) throw new Error('Unexpected public configuration format.');
  const config = JSON.parse(match[1]);
  if (config.url !== 'https://zsqvmuqlmtnhndwuqlfy.supabase.co') throw new Error('Unexpected news project URL.');
  const key = String(config.anonKey || '');
  if (key.startsWith('sb_publishable_')) return config;
  let claims;
  try { claims = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()); } catch {}
  if (claims?.role !== 'anon' || claims?.ref !== 'zsqvmuqlmtnhndwuqlfy') throw new Error('Only the news project public anon/publishable key is allowed.');
  return config;
}
try {
  let existing;
  try { existing = await fs.readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing !== undefined) {
    validate(existing);
    console.log('Existing public configuration verified; no file overwritten.');
  } else {
    const response = await fetch(source, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error(`Public configuration download failed (${response.status}).`);
    const text = await response.text();
    if (text.length > 16000) throw new Error('Public configuration is unexpectedly large.');
    const config = validate(text);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, 'window.ALNUQTA_SUPABASE_PUBLIC = ' + JSON.stringify({url:config.url,anonKey:config.anonKey}) + ';\n', { flag:'wx', mode:0o600 });
    console.log('Local public configuration ready. Open index.html with your local web server / Live Server.');
  }
} catch (error) {
  console.error('Local setup failed: ' + error.message);
  process.exitCode = 1;
}
