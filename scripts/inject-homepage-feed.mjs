import fs from 'node:fs';

const file = 'index.html';
const marker = '<script src="public/homepage-dynamic.js"></script>';
const html = fs.readFileSync(file, 'utf8');

if (html.includes(marker)) {
  console.log('Homepage feed script already injected.');
  process.exit(0);
}

const closingScript = '    </script>\n</body>';
if (!html.includes(closingScript)) {
  throw new Error('Could not find the homepage inline script boundary.');
}

const updated = html.replace(closingScript, `    ${marker}\n${closingScript}`);
fs.writeFileSync(file, updated);
console.log('Injected dynamic newsroom feed into homepage build.');
