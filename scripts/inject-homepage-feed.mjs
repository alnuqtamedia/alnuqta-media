import fs from 'node:fs';

const file = 'index.html';
const markers = [
  '<script src="public/supabase-public-config.js"></script>',
  '<script src="public/homepage-dynamic.js"></script>',
  '<script src="public/supabase-feed.js"></script>',
  '<script src="public/homepage-navigation.js"></script>'
];
const html = fs.readFileSync(file, 'utf8');
const closingScript = '    </script>\n</body>';
if (!html.includes(closingScript)) {
  throw new Error('Could not find the homepage inline script boundary.');
}

const missing = markers.filter((marker) => !html.includes(marker));
if (!missing.length) {
  console.log('Homepage dynamic scripts already injected.');
  process.exit(0);
}

// External scripts must be placed AFTER the inline script closes.
const scripts = missing.map((marker) => `    ${marker}`).join('\n');
const updated = html.replace(closingScript, `    </script>\n${scripts}\n</body>`);
fs.writeFileSync(file, updated);
console.log(`Injected ${missing.length} homepage script(s).`);
