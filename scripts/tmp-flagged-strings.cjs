/**
 * Print the exact className strings with unpaired light tokens for a file.
 * Usage: node scripts/tmp-flagged-strings.cjs <relative-path>
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const LIGHT = ['bg-white', 'bg-slate-50', 'bg-slate-100', 'bg-slate-200', 'bg-gray-50', 'bg-gray-100', 'bg-gray-200', 'bg-zinc-50', 'bg-zinc-100', 'bg-zinc-200', 'bg-[#f', 'bg-[#e',
  'text-black', 'text-slate-500', 'text-slate-600', 'text-slate-700', 'text-gray-500', 'text-gray-600', 'text-gray-700',
  'border-black/5', 'border-black/10', 'border-gray-100', 'border-gray-200', 'border-gray-300'];

const rel = process.argv[2];
const file = path.join(ROOT, 'frontend/src', rel);
const c = fs.readFileSync(file, 'utf8');
const lines = c.split('\n');

lines.forEach((line, i) => {
  for (const m of line.matchAll(/className=(?:"([^"{}]*)"|\{([\s\S]*?)\})/g)) {
    const s = (m[1] !== undefined ? m[1] : m[2]).replace(/\s+/g, ' ');
    const tokens = s.split(' ').filter(Boolean);
    const lightTok = tokens.filter((t) => LIGHT.some((l) => t === l || t.startsWith(l)));
    if (!lightTok.length) continue;
    const covered = new Set(tokens.filter((t) => t.startsWith('dark:')).map((t) => t.slice(5).split(/[-[/]/)[0]));
    const unpaired = lightTok.filter((t) => {
      const prop = t.replace(/^(bg|text|border).*/, '$1');
      return !covered.has(prop);
    });
    if (unpaired.length) {
      console.log(`${i + 1}: ${s.trim().slice(0, 200)}`);
      console.log(`     unpaired: ${unpaired.join('  ')}`);
    }
  }
});
