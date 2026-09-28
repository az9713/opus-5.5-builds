// build.js — embeds every JPG in photos/ as a base64 data URI into
// template.html and writes the result as index.html. Run with:
//   node build.js
// Re-run any time template.html or the photos change; index.html is the
// file to double-click and open (works from file:// with no network calls).
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PHOTOS_DIR = path.join(ROOT, 'photos');
const TEMPLATE = path.join(ROOT, 'template.html');
const OUTPUT = path.join(ROOT, 'index.html');

const files = fs.readdirSync(PHOTOS_DIR).filter(f => /\.jpe?g$/i.test(f));
if (files.length === 0) {
  throw new Error('No JPG files found in ' + PHOTOS_DIR);
}

const photos = files.map(file => {
  const id = file.replace(/\.jpe?g$/i, '');
  const bytes = fs.readFileSync(path.join(PHOTOS_DIR, file));
  const dataUri = 'data:image/jpeg;base64,' + bytes.toString('base64');
  return { id, file, dataUri };
});

const template = fs.readFileSync(TEMPLATE, 'utf8');
const marker = /\/\*__PHOTOS__\*\/\[\]\/\*__END_PHOTOS__\*\//;
if (!marker.test(template)) {
  throw new Error('Placeholder /*__PHOTOS__*/[]/*__END_PHOTOS__*/ not found in template.html');
}
const injected = JSON.stringify(photos);
const output = template.replace(marker, '/*__PHOTOS__*/' + injected + '/*__END_PHOTOS__*/');

fs.writeFileSync(OUTPUT, output, 'utf8');
console.log('Wrote ' + OUTPUT + ' with ' + photos.length + ' photos:');
photos.forEach(p => console.log('  - ' + p.file));
