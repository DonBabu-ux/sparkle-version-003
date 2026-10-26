/**
 * Dark-mode codemod, pass 3: template-literal classNames, per-token.
 *
 * For each mapped light token inside a className={...} expression that lacks a
 * dark counterpart of the same property, append the counterpart immediately
 * after the token. Ternary branches keep distinct dark surfaces because each
 * token carries its own pair.
 *
 * Idempotent; run after tmp-darkmode-codemod.cjs passes 1-2.
 */
const fs = require('fs');
const path = require('path');

const ROOTS = ['frontend/src/pages', 'frontend/src/components', 'frontend/src/hooks', 'frontend/src/store'];
const WRITE = process.argv.includes('--write');

const MAP = {
  'bg-white': 'dark:bg-[#1b1b24]',
  'bg-slate-50': 'dark:bg-[#101217]',
  'bg-slate-100': 'dark:bg-[#101217]',
  'bg-gray-50': 'dark:bg-[#101217]',
  'bg-gray-100': 'dark:bg-[#101217]',
  'bg-zinc-50': 'dark:bg-[#101217]',
  'bg-zinc-100': 'dark:bg-zinc-800',
  'bg-[#fdf2f4]': 'dark:bg-[#1b1b24]',
  'bg-[#fff0f4]': 'dark:bg-[#1b1b24]',
  'bg-[#f0f2f5]': 'dark:bg-[#1b1b24]',
  'bg-[#f2f2f2]': 'dark:bg-[#1b1b24]',
  'text-black': 'dark:text-white',
  'text-slate-500': 'dark:text-zinc-400',
  'text-slate-600': 'dark:text-zinc-300',
  'text-slate-700': 'dark:text-zinc-200',
  'text-gray-500': 'dark:text-zinc-400',
  'text-gray-600': 'dark:text-zinc-300',
  'text-gray-700': 'dark:text-zinc-200',
  'border-black/5': 'dark:border-white/5',
  'border-black/10': 'dark:border-white/10',
  'border-gray-100': 'dark:border-white/10',
  'border-gray-200': 'dark:border-white/10',
  'border-gray-300': 'dark:border-white/10',
};

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name) && !e.name.includes('.test.')) acc.push(p);
  }
  return acc;
}

const propOf = (dark) => dark.slice(5).split(/[-[/]/)[0];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let files = 0, tokens = 0;

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    let src = fs.readFileSync(file, 'utf8');
    let added = 0;
    src = src.replace(/className=\{([\s\S]*?)\}/g, (full, inner) => {
      const covered = new Set(
        (inner.match(/dark:[a-z-]+/g) || []).map((t) => propOf(t))
      );
      let out = inner;
      for (const [light, dark] of Object.entries(MAP)) {
        const prop = propOf(dark);
        if (covered.has(prop)) continue;
        const re = new RegExp('(?<![\\w-])' + escapeRe(light) + '(?![\\w-])', 'g');
        const hits = out.match(re);
        if (hits && hits.length) {
          out = out.replace(re, (m) => `${m} ${dark}`);
          added += hits.length;
          covered.add(prop);
        }
      }
      return `className={${out}}`;
    });
    if (added > 0) {
      files++;
      tokens += added;
      if (WRITE) fs.writeFileSync(file, src);
    }
  }
}
console.log(`${WRITE ? 'WROTE' : 'DRY RUN'}: ${files} files, ${tokens} template tokens`);
