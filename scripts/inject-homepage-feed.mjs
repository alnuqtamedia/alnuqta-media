import fs from 'node:fs';

const file = 'index.html';
const markers = [
  '<script src="public/sections.js?v=20261004-1"></script>',
  '<script src="public/supabase-public-config.js"></script>',
  '<script src="public/supabase-feed.js?v=20261004-3"></script>',
  '<script src="public/homepage-navigation.js"></script>'
];
const html = fs.readFileSync(file, 'utf8');
const closingBody = '</body>';
if (!html.includes(closingBody)) throw new Error('Could not find the homepage body boundary.');

const missing = markers.filter((marker) => !html.includes(marker.match(/src="([^?"]+)/)[1]));
if (!missing.length) {
  console.log('Homepage dynamic scripts already injected.');
  process.exit(0);
}

let updated = html;
for (const marker of missing) {
  updated = marker.includes('sections.js')
    ? updated.replace('</head>', marker + '\n</head>')
    : updated.replace(closingBody, marker + '\n' + closingBody);
}
fs.writeFileSync(file, updated);
console.log(`Injected ${missing.length} homepage script(s).`);
