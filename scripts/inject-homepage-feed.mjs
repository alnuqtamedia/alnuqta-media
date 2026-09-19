import fs from 'node:fs';

const file = 'index.html';
const markers = [
  '<script src="public/supabase-public-config.js"></script>',
  '<script src="public/homepage-dynamic.js"></script>',
  '<script src="public/supabase-feed.js"></script>',
  '<script src="public/homepage-navigation.js"></script>'
];
const html = fs.readFileSync(file, 'utf8');
const closingBody = '</body>';
if (!html.includes(closingBody)) throw new Error('Could not find the homepage body boundary.');

const missing = markers.filter((marker) => !html.includes(marker));
if (!missing.length) {
  console.log('Homepage dynamic scripts already injected.');
  process.exit(0);
}

const scripts = missing.map((marker) => `    ${marker}`).join('\n');
const updated = html.replace(closingBody, `${scripts}\n</body>`);
fs.writeFileSync(file, updated);
console.log(`Injected ${missing.length} homepage script(s).`);
