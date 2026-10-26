const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PAGES = path.join(ROOT, 'frontend/src/pages');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(PAGES).filter(f => /\.tsx?$/.test(f)).sort();
let shellHits = 0, other = [];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  let found = false;
  lines.forEach((l, i) => {
    if (/min-h-screen|h-screen/.test(l) && /\bbg-(white|slate-50|gray-50|\[#f|\[#0)/.test(l)) {
      const m = l.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
      console.log('SHELL  ' + path.relative(ROOT, f) + ':' + (i + 1));
      console.log('       ' + (m ? (m[1] || m[2]).slice(0, 200) : l.trim().slice(0, 200)));
      found = true; shellHits++;
    }
  });
  if (!found) other.push(path.relative(ROOT, f));
}
console.log('\nshell hits:', shellHits, ' files without min-h-screen shell:', other.length);
console.log(other.join('\n'));
