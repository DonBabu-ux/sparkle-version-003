/* cDex inline-style dark-mode audit.
 *
 * Scans every <style> block in the frontend source for light-only
 * surfaces: background/color declarations with hardcoded light values
 * and no matching .dark override. Companion to css-important-audit.js.
 *
 *   node scripts/css-inline-audit.js [--verbose]
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'frontend', 'src');
const verbose = process.argv.includes('--verbose');

const LIGHT_BG = /background(?:-color)?\s*:\s*(?:white|#f[0-9a-f]{2,5}|#e[fF][0-9a-f]|#fa[0-9a-f]{3,5}|#fd[0-9a-f]{3,5}|#f[0-9a-f]{5})\b/i;
const LIGHT_TEXT = /color\s*:\s*#(?:0f|1e|1[0-9a-f]|2[0-9a-f]|3[0-9a-f]|4[0-9a-f]|5[0-9a-f]|6[0-7])[0-9a-f]{4}/i;
const LIGHT_VAR = /var\(--[a-z-]+,\s*#f[0-9a-f]{2,5}\)/i;

const findings = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { walk(path.join(dir, e.name)); continue; }
    if (!e.name.endsWith('.tsx')) continue;
    const file = path.join(dir, e.name);
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');

    let inStyle = false, depth = 0, block = '';
    let blockStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inStyle && /<style/.test(line)) {
        inStyle = true; block = ''; blockStart = i + 1;
        const after = line.slice(line.search(/<style/) + 6);
        if (/`/.test(after)) block += after.split('`').slice(1).join('`') + '\n';
        continue;
      }
      if (inStyle) {
        if (/<\/style>/.test(line)) {
          inStyle = false;
          const before = line.split('</style>')[0];
          if (!/`/.test(before)) block += before;
          if (/`[^`]*`/.test(before)) block += before.split('`')[1] + '\n';
        } else {
          block += line + '\n';
        }
        if (!inStyle) {
          const rules = block.split('}');
          const darkSelectors = new Set();
          const lightSurfaces = [];
          for (const rule of rules) {
            const idx = rule.indexOf('{');
            if (idx === -1) continue;
            const sel = rule.slice(0, idx).trim();
            const body = rule.slice(idx + 1);
            if (!sel) continue;
            if (/\.dark\b|data-chat-mode/.test(sel)) {
              for (const s of sel.split(',')) darkSelectors.add(s.trim().replace(/\.dark\s*/, '').replace(/data-chat-mode="[a-z]+"\s*/g, '').trim());
              continue;
            }
            if (LIGHT_BG.test(body) || LIGHT_TEXT.test(body) || LIGHT_VAR.test(body)) {
              lightSurfaces.push(sel);
            }
          }
          const uncovered = lightSurfaces.filter((sel) => {
            const bare = sel.replace(/^\s*/, '');
            for (const d of darkSelectors) {
              if (d === bare || d.endsWith(bare) || bare.endsWith(d)) return false;
            }
            return true;
          });
          if (uncovered.length) {
            findings.push({ file: path.relative(SRC, file), line: blockStart, selectors: uncovered });
          }
        }
        continue;
      }
    }
  }
}

walk(SRC);

console.log('=== inline-style dark-mode audit (' + findings.length + ' blocks with light-only surfaces) ===\n');
for (const f of findings) {
  console.log(f.file + '  (style at line ' + f.line + ')');
  for (const s of f.selectors.slice(0, verbose ? 99 : 4)) console.log('   ' + s);
  if (f.selectors.length > 4 && !verbose) console.log('   ... +' + (f.selectors.length - 4) + ' more');
}
const total = findings.reduce((n, f) => n + f.selectors.length, 0);
console.log('\n=== ' + total + ' uncovered light surface(s) across ' + findings.length + ' style block(s) ===');
console.log('run with --verbose for the full list');
