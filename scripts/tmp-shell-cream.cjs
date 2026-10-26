const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PAGES = path.join(ROOT, 'frontend/src/pages');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(PAGES).filter(f => /\.tsx?$/.test(f)).sort();
const APPLY = process.argv.includes('--apply');
const CREAM = '#fdf2f4';
// light shells that should become cream; dark partners are preserved
const LIGHT_SHELLS = [
  'bg-white', 'bg-slate-50', 'bg-gray-50', 'bg-[#fafafd]', 'bg-[#fafafa]', 'bg-[#FBFBFD]'
];
let changed = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const ret = src.indexOf('return (');
  if (ret < 0) continue;
  const after = src.slice(ret);
  const m = after.match(/<div\s+className=(?:"([^"]*)"|\{\s*`([^`]*)`\s*\})/);
  if (!m) continue;
  const cls = m[1] !== undefined ? m[1] : m[2];
  let newCls = cls, hits = [];
  for (const tok of LIGHT_SHELLS) {
    // exact token, not /opacity variant, not already dark:-prefixed
    const re = new RegExp('(?<![\\w:-])' + tok.replace('[', '\\[').replace(']', '\\]') + '(?![\\w/])', 'g');
    const found = cls.match(re);
    if (found) { hits.push(tok + 'x' + found.length); newCls = newCls.replace(re, 'bg-[' + CREAM + ']'); }
  }
  if (!hits.length) continue;
  changed++;
  const rel = path.relative(ROOT, f);
  const before = cls.slice(0, 160);
  const afterC = newCls.slice(0, 160);
  console.log((APPLY ? 'APPLY ' : 'DRY   ') + rel + '  [' + hits.join(',') + ']');
  console.log('   - ' + before);
  console.log('   + ' + afterC);
  if (APPLY) {
    const oldFull = m[1] !== undefined ? 'className="' + m[1] + '"' : 'className={`' + m[2] + '`}';
    const newFull = m[1] !== undefined ? 'className="' + newCls + '"' : 'className={`' + newCls + '`}';
    if (src.indexOf(oldFull) < 0) { console.log('   !! exact match failed, skipped'); continue; }
    fs.writeFileSync(f, src.replace(oldFull, newFull));
  }
}
console.log('\nfiles to change: ' + changed + (APPLY ? ' (applied)' : ' (dry run)'));
