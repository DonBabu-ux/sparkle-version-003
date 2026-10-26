/**
 * Light-mode readability scanner v2 (read-only) — precise rule only.
 *
 * Flags className strings where a white-family TEXT token appears with NO
 * dark: counterpart for text in the same string, inside files that are not
 * intentionally-dark surfaces (chat/moments/stories/camera own dark).
 * Those elements render white text on whatever the light-mode surface is.
 */
const fs = require('fs');
const path = require('path');

const DARK_OWNING = ['pages/Messages.tsx', 'pages/Moments.tsx', 'pages/CreateStory.tsx', 'pages/StoryViewer.tsx', 'pages/Streams.tsx', 'pages/MomentStudio.tsx', 'pages/Memories.tsx', 'components/chat/', 'components/stories/', 'components/camera/', 'components/video/', 'components/CallOverlay', 'components/CallProvider'];

// saturated/dark backgrounds where white text is correct in both modes
const OK_BG = new RegExp('^(bg-\[#(ff1493|ff006e|ff008a|FF008A|0A0B10|111118|1b1b24|101217|000000|000|07020d|0f1015|111116|0f0f14)\]|bg-(purple|pink|rose|blue|indigo|violet|emerald|red|green|slate-9|zinc-9|gray-9|black))');

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name) && !e.name.includes('.test.')) acc.push(p);
  }
  return acc;
}

const rows = [];
for (const f of ['frontend/src/pages', 'frontend/src/components'].flatMap((r) => walk(r))) {
  const rel = path.relative('frontend/src', f).replace(/\\/g, '/');
  if (DARK_OWNING.some((p) => rel.includes(p))) continue;
  const c = fs.readFileSync(f, 'utf8');
  const hits = [];
  for (const m of c.matchAll(/className=(?:"([^"{}]*)"|\{([\s\S]*?)\})/g)) {
    const s = (m[1] !== undefined ? m[1] : m[2]).replace(/\s+/g, ' ');
    const tokens = s.split(' ').filter(Boolean);
    if (!tokens.some((t) => /^text-white(\/\d+)?$/.test(t))) continue;
    const lightBg = tokens.some((t) => /^bg-(white(\/\d+)?|slate-(50|100|200)|gray-(50|100|200)|zinc-(50|100|200)|\[#f|\[#e)/.test(t));
    if (!lightBg) continue;
    if (tokens.some((t) => t.startsWith('dark:text-'))) continue;
    if (tokens.some((t) => OK_BG.test(t))) continue; // white on saturated bg is fine
    hits.push(s.slice(0, 120));
  }
  if (hits.length) rows.push({ file: rel, count: hits.length, hits: hits.slice(0, 3) });
}
rows.sort((a, b) => b.count - a.count);
for (const r of rows.slice(0, 24)) {
  console.log(`${r.file} — ${r.count}`);
  r.hits.forEach((h) => console.log(`   ${h}`));
}
console.log(`total files: ${rows.length}`);
