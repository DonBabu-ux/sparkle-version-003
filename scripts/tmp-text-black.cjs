const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'frontend/src');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(SRC).filter(f => /\.tsx?$/.test(f));
const APPLY = process.argv.includes('--apply');
const re = /(?<![\w:-])text-black(?![\/\w-])/g;
let filesHit = 0, total = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const n = (src.match(re) || []).length;
  if (!n) continue;
  filesHit++; total += n;
  if (APPLY) fs.writeFileSync(f, src.replace(re, 'text-[#18181b]'));
}
console.log((APPLY ? 'applied' : 'dry') + ': ' + total + ' tokens in ' + filesHit + ' files -> text-[#18181b]');
