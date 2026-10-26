/* cDex light-mode audit — mirror of css-inline-audit.js.
 *
 * Finds inline <style> surfaces painted dark with no light counterpart,
 * which break LIGHT mode the way the dark audit caught light leaks.
 *
 *   node scripts/css-light-audit.js [--verbose]
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'frontend', 'src');
const verbose = process.argv.includes('--verbose');

/* Only neutral greys/black/white are theme-dependent. Brand and status
   colors (#ff1493 pink, #10b981 green, #f59e0b amber...) work identically
   on both themes, so matching them by hex range produced false positives. */
const DARK_VALUES = '000|000000|0a0a0a|0a0a0f|0b0b0f|0d0f13|0f0f14|111118|121212|12151c|13131a|18181b|1b1b24|07020d|090514|0e0720|04020a';
const LIGHT_VALUES = 'fff|ffffff|f0f0f5|f5f5f5|f8fafc|f0f2f5|e8eaed|e2e8f0|f1f5f9|e5e7eb|f3f4f6|f9fafb|fdfdfe|fcfdfe|fdf2f4';
const DARK_BG = new RegExp('background(?:-color)?\\s*:\\s*#(?:' + DARK_VALUES + ')\\b', 'i');
const LIGHT_TEXT = new RegExp('(?:^|[{;\\s])color\\s*:\\s*#(?:' + LIGHT_VALUES + ')\\b', 'i');

const isLightCounterpart = (sel) =>
  /:not\(\.dark\)/.test(sel) || /\.dark\b/.test(sel) || /data-chat-mode/.test(sel) ||
  /^html:not\(\.dark\)/.test(sel) || /:not\(\[?data-theme/.test(sel);

const findings = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { walk(path.join(dir, e.name)); continue; }
    if (!e.name.endsWith('.tsx')) continue;
    const file = path.join(dir, e.name);
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');

    let inStyle = false, block = '', blockStart = 0, sawLightScope = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inStyle && /<style/.test(line)) {
        inStyle = true; block = ''; blockStart = i + 1; sawLightScope = false;
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
          const clean = block.replace(/\/\*[\s\S]*?\*\//g, '');
          const rules = clean.split('}');
          const darkSurfaces = [];
          const counterpartSelectors = new Set();
          const rules2 = [];
          for (const rule of rules) {
            const idx = rule.indexOf('{');
            if (idx === -1) continue;
            rules2.push({ sel: rule.slice(0, idx).trim(), body: rule.slice(idx + 1) });
          }
          for (const r of rules2) {
            if (isLightCounterpart(r.sel)) {
              const bare = r.sel
                .replace(/html:not\(\.dark\)\s*/, '')
                .replace(/:not\(\.dark\)\s*/, '')
                .replace(/\.dark\s*/, '')
                .replace(/data-chat-mode="[a-z]+"\s*/, '')
                .replace(/\s+/g, ' ')
                .trim();
              counterpartSelectors.add(bare);
            }
          }
          for (const r of rules2) {
            const sel = r.sel, body = r.body;
            if (!sel) continue;
            if (isLightCounterpart(sel)) continue;
            if (/^\s*\/\//.test(sel)) continue;
            if (/prefers-color-scheme|@media/.test(sel)) continue;
            if (DARK_BG.test(body) || (LIGHT_TEXT.test(body) && !/background/.test(body))) {
              const bare = sel.replace(/\s+/g, ' ').trim();
              const covered = [...counterpartSelectors].some(
                (c) => c === bare || c.endsWith(bare) || bare.endsWith(c)
              );
              if (!covered) darkSurfaces.push(bare);
            }
          }
          if (darkSurfaces.length) {
            findings.push({ file: path.relative(SRC, file), line: blockStart, selectors: darkSurfaces });
          }
        }
        continue;
      }
    }
  }
}

walk(SRC);

console.log('=== light-mode audit (' + findings.length + ' blocks with uncovered dark-only surfaces) ===\n');
for (const f of findings) {
  console.log(f.file + '  (style at ' + f.line + ')  - no light counterpart');
  for (const s of f.selectors.slice(0, verbose ? 99 : 4)) console.log('   ' + s);
  if (f.selectors.length > 4 && !verbose) console.log('   ... +' + (f.selectors.length - 4) + ' more');
}
const total = findings.reduce((n, f) => n + f.selectors.length, 0);
console.log('\n=== ' + total + ' uncovered dark-only surface(s) across ' + findings.length + ' block(s) ===');
