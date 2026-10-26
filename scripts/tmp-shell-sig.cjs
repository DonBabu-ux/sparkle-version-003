const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PAGES = path.join(ROOT, 'frontend/src/pages');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(PAGES).filter(f => /\.tsx?$/.test(f)).sort();
const sigs = {};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // outermost div = first <div className= after the first "return ("
  const ret = src.indexOf('return (');
  if (ret < 0) { sigs['<no return>'] = (sigs['<no return>'] || 0) + 1; continue; }
  const after = src.slice(ret);
  const m = after.match(/<div\s+className=(?:"([^"]*)"|\{`([^`]*)`\})/);
  if (!m) { sigs['<no outer div>'] = (sigs['<no outer div>'] || 0) + 1; continue; }
  const cls = m[1] || m[2];
  const bgs = (cls.match(/bg-(?:white|black|slate-\d+|gray-\d+|zinc-\d+|\[#[0-9a-fA-F]+\])(?:\/\d+)?/g) || []).join(' ');
  sigs[bgs || '<no bg>'] = (sigs[bgs || '<no bg>'] || 0) + 1;
}
Object.entries(sigs).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(3) + 'x  ' + k));
