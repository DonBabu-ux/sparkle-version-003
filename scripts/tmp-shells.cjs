const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const roots = [path.join(ROOT, 'frontend/src/pages'), path.join(ROOT, 'frontend/src/components')];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = roots.flatMap(walk).filter(f => /\.tsx?$/.test(f));
const counts = {};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const pats = {
    'bg-white + dark:bg-[#1b1b24]': /bg-white\s+dark:bg-\[#1b1b24\]/g,
    'bg-white + dark:bg-[#101217]': /bg-white\s+dark:bg-\[#101217\]/g,
    'bg-[#fdf2f4]': /bg-\[#fdf2f4\]/g,
    'bg-[#f0f2f5]': /bg-\[#f0f2f5\]/g,
    'bg-[#fafafd]': /bg-\[#fafafd\]/g,
    'bg-gray-100': /bg-gray-100\b/g,
    'bg-slate-50': /bg-slate-50\b/g,
  };
  for (const [k, re] of Object.entries(pats)) {
    const n = (src.match(re) || []).length;
    if (n) counts[k] = (counts[k] || 0) + n;
  }
}
Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(5) + 'x  ' + k));
