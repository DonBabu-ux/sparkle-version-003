const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const files = [
  'frontend/src/pages/Settings.tsx',
  'frontend/src/components/settings/SettingCardGroup.tsx',
  'frontend/src/components/settings/SettingRow.tsx',
  'frontend/src/components/ui/Spinner.tsx',
];
const COLORISH = /^(?:dark:)?(?:bg|text|border|ring|fill|stroke|divide|outline|accent|selection|placeholder|from|via|to|shadow)-/;
const SIZEISH = /^(?:text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)|bg-(?:gradient|linear|conic|radial)|border-[trbl]|border-[0-9]|divide-y|text-(?:left|center|right)|text-current)$/;
const pairs = [];
for (const rel of files) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    // only lines that look like className strings
    if (!/className/.test(l)) return;
    const m = l.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
    if (!m) return;
    const cls = m[1] || m[2];
    // collect tokens with position
    const toks = [];
    const re = /(?:^|\s)([a-z:-]+[a-zA-Z0-9:\[\]#()./%-]+)/g;
    let t;
    while ((t = re.exec(cls))) toks.push({ raw: t[1], idx: t.index });
    const light = toks.filter(x => !x.raw.startsWith('dark:') && COLORISH.test(x.raw) && !SIZEISH.test(x.raw));
    const dark = toks.filter(x => x.raw.startsWith('dark:') && COLORISH.test(x.raw.slice(5)) && !SIZEISH.test(x.raw.slice(5)));
    // pair by nearest dark token after each light token
    const used = new Set();
    for (const lt of light) {
      // find first dark token to the right within 120 chars
      let best = null;
      for (const dt of dark) {
        if (used.has(dt) || dt.idx <= lt.idx || dt.idx - lt.idx > 160) continue;
        if (!best || dt.idx < best.idx) best = dt;
      }
      if (best) { used.add(best); pairs.push({ file: rel, line: i + 1, light: lt.raw, dark: best.raw.slice(5), status: 'paired' }); }
      else pairs.push({ file: rel, line: i + 1, light: lt.raw, dark: null, status: 'LIGHT-ONLY' });
    }
    for (const dt of dark) if (!used.has(dt)) pairs.push({ file: rel, line: i + 1, light: null, dark: dt.raw.slice(5), status: 'DARK-ONLY' });
  });
}
const lightOnly = pairs.filter(p => p.status === 'LIGHT-ONLY');
const darkOnly = pairs.filter(p => p.status === 'DARK-ONLY');
const paired = pairs.filter(p => p.status === 'paired');
console.log('=== PAIRED (light -> dark) ' + paired.length + ' ===');
// unique pairs summary
const uniq = new Map();
for (const p of paired) { const k = p.light + '  ->  ' + p.dark; if (!uniq.has(k)) uniq.set(k, []); uniq.get(k).push(p.file.split(/[\\/]/).pop() + ':' + p.line); }
[...uniq.entries()].sort().forEach(([k, v]) => console.log('  ' + k.padEnd(62) + ' x' + String(v.length).padEnd(3) + v[0]));
console.log('\n=== LIGHT-ONLY (stays light in dark mode) ' + lightOnly.length + ' ===');
for (const p of lightOnly) console.log('  ' + (p.light || '').padEnd(40) + p.file.split(/[\\/]/).pop() + ':' + p.line);
console.log('\n=== DARK-ONLY ' + darkOnly.length + ' ===');
for (const p of darkOnly) console.log('  ' + (p.dark || '').padEnd(40) + p.file.split(/[\\/]/).pop() + ':' + p.line);
