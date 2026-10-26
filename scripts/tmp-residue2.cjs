const fs = require('fs');
const path = require('path');

const LIGHT_TO_DARK_PROP = {
  'bg-white': 'bg',
  'bg-slate-50': 'bg', 'bg-slate-100': 'bg',
  'bg-gray-50': 'bg', 'bg-gray-100': 'bg', 'bg-gray-200': 'bg', 'bg-zinc-50': 'bg', 'bg-zinc-100': 'bg',
  'bg-[#fdf2f4]': 'bg', 'bg-[#fff0f4]': 'bg', 'bg-[#f0f2f5]': 'bg', 'bg-[#f2f2f2]': 'bg',
  'text-black': 'text',
  'text-slate-500': 'text', 'text-slate-600': 'text', 'text-slate-700': 'text',
  'text-gray-500': 'text', 'text-gray-600': 'text', 'text-gray-700': 'text',
  'border-black/5': 'border', 'border-black/10': 'border',
  'border-gray-100': 'border', 'border-gray-200': 'border', 'border-gray-300': 'border',
};

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/** Count light tokens whose className string lacks a dark: variant of the same property. */
function unpaired(classString) {
  const tokens = classString.split(/\s+/).filter(Boolean);
  const darkProps = new Set(tokens.filter((t) => t.startsWith('dark:')).map((t) => t.slice(5).split(/[-[/]/)[0]));
  let n = 0;
  for (const t of tokens) {
    const prop = LIGHT_TO_DARK_PROP[t];
    if (prop && !darkProps.has(prop)) n++;
  }
  return n;
}

function countInFile(c) {
  let found = 0;
  for (const m of c.matchAll(/className=(?:"([^"{}]*)"|\{([\s\S]*?)\})/g)) {
    if (m[1] !== undefined) found += unpaired(m[1]);
    else found += unpaired((m[2].match(/[a-zA-Z0-9:\[\]#\-/.\s]+/gi) || []).join(' '));
  }
  return found;
}

let total = 0;
const rows = [];
for (const f of ['frontend/src/pages', 'frontend/src/components'].flatMap(walk)) {
  const n = countInFile(fs.readFileSync(f, 'utf8'));
  if (n > 0) { total += n; rows.push({ f: path.relative('frontend/src', f), unpaired: n }); }
}
rows.sort((a, b) => b.unpaired - a.unpaired);
console.table(rows.slice(0, 15));
console.log('files with unpaired light tokens:', rows.length, ' total unpaired:', total);
