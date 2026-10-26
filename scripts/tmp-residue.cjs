const fs = require('fs');
const path = require('path');
const M = /bg-white(?!\/)|text-black(?![a-z0-9/-])|border-black\/|bg-slate-(50|100)|bg-gray-(50|100|200)|text-slate-(500|600|700)|text-gray-(500|600|700)/g;
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}
let total = 0;
const rows = [];
for (const f of ['frontend/src/pages', 'frontend/src/components'].flatMap(walk)) {
  const c = fs.readFileSync(f, 'utf8');
  const n = (c.match(M) || []).length;
  if (n > 0) { total += n; rows.push({ f: path.relative('frontend/src', f), n }); }
}
rows.sort((a, b) => b.n - a.n);
console.table(rows.slice(0, 10));
console.log('files with remaining light tokens:', rows.length, ' total tokens:', total);
