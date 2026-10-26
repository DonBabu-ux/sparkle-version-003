/**
 * Dark-mode conversion codemod — passes 1-2 only (safe set).
 *
 * Pass 1: static className="..." literals — per-token dark counterparts.
 * Pass 2: template-literal classNames — only when every mapped token in the
 *         template maps to the SAME dark value; the token is appended once,
 *         outside any ternary.
 *
 * House palette (from converted screens): dark:bg-[#1b1b24] primary surface,
 * dark:bg-[#101217] soft surface, dark:text-white/zinc-*, dark:border-white/5|10.
 *
 * Idempotent. Usage: node scripts/tmp-darkmode-codemod.cjs [--write]
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

const propOf = (dark) => dark.slice(5).split(/[-[/]/)[0];

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name) && !e.name.includes('.test.')) acc.push(p);
  }
  return acc;
}

let filesChanged = 0, tokensAdded = 0;

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    let src = fs.readFileSync(file, 'utf8');
    let fileTokens = 0;

    // Pass 1: static className="..." literals (no braces inside).
    src = src.replace(/className="([^"{}]*)"/g, (full, inner) => {
      const tokens = inner.split(/\s+/).filter(Boolean);
      const out = [];
      for (const t of tokens) {
        out.push(t);
        const dark = MAP[t];
        if (!dark) continue;
        if (tokens.some((x) => x.startsWith('dark:') && x.slice(5).startsWith(propOf(dark)))) continue;
        out.push(dark);
        fileTokens++;
      }
      return `className="${out.join(' ')}"`;
    });

    // Pass 2: fully-static literal template classNames only — no ${}, braces,
    // parens (clsx) or '?' (ternary) — so the capture always ends at the real
    // closing brace and never lands inside an expression.
    src = src.replace(/className=\{([^{}$()?]*)\}/g, (full, inner) => {
      const tokens = (inner.match(/[a-zA-Z0-9:\[\]#\-/.\s]+/gi) || []).join(' ').split(/\s+/).filter(Boolean);
      const mapped = [...new Set(tokens.map((t) => MAP[t]).filter(Boolean))];
      if (mapped.length !== 1) return full;
      const dark = mapped[0];
      if (inner.includes(`dark:${propOf(dark)}`)) return full;
      fileTokens++;
      return `className={${inner} "${dark}"}`;
    });

    if (fileTokens > 0) {
      filesChanged++;
      tokensAdded += fileTokens;
      if (WRITE) fs.writeFileSync(file, src);
    }
  }
}

console.log(`${WRITE ? 'WROTE' : 'DRY RUN'}: ${filesChanged} files, ${tokensAdded} dark variants`);
