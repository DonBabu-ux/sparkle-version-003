const fs = require('fs');
const path = require('path');

const SRC = 'C:/Users/senior/Documents/sparkle-version-003-main/frontend/src';
const files = [];
(function find(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) find(path.join(dir, e.name));
    else if (e.name.endsWith('.css')) files.push(path.join(dir, e.name));
  }
})(SRC);

const rules = [];
for (const file of files) {
  const css = fs.readFileSync(file, 'utf8');
  let order = 0;
  (function walk(s, layers, media) {
    let j = 0;
    while (j < s.length) {
      const brace = s.indexOf('{', j);
      if (brace === -1) break;
      const sel = s.slice(j, brace).trim();
      let depth = 0, k = brace;
      for (; k < s.length; k++) {
        if (s[k] === '{') depth++;
        else if (s[k] === '}') { depth--; if (depth === 0) break; }
      }
      if (k >= s.length) break;
      const body = s.slice(brace + 1, k);
      if (sel.startsWith('@layer') && sel.includes('{')) {
        walk(body, layers.concat([sel.replace(/^@layer\s*/, '').split('{')[0].trim() || '(anon)']), media);
      } else if (sel.startsWith('@media') || sel.startsWith('@supports')) {
        walk(body, layers, sel.replace(/^@(?:media|supports)\s*/, '').trim());
      } else if (sel && !sel.startsWith('@')) {
        const decls = [];
        for (const part of body.split(';')) {
          const m = part.match(/^\s*([a-z-]+)\s*:\s*(.+?)\s*$/i);
          if (!m) continue;
          const val = m[2].trim();
          decls.push({ prop: m[1].toLowerCase(), val: val.replace(/\s*!important\s*$/i, ''), imp: /!important\s*$/i.test(val) });
        }
        for (const one of sel.split(',')) {
          rules.push({ sel: one.trim(), layer: layers, media, decls, order: order++, file: path.basename(file) });
        }
      }
      j = k + 1;
    }
  })(css, [], null);
}

const imps = rules.filter((r) => r.decls.some((d) => d.imp));
console.log('=== !important audit — ' + rules.length + ' rules, ' + imps.length + ' carry !important ===\n');

function target(sel) {
  const parts = sel.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

function sameTarget(a, b) {
  return a === b || a.endsWith(' ' + b) || b.endsWith(' ' + a);
}

const groups = {};
for (const r of imps) {
  for (const d of r.decls) {
    if (!d.imp) continue;
    (groups[d.prop] = groups[d.prop] || []).push({ r, d });
  }
}

const fights = [];
for (const [prop, list] of Object.entries(groups)) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      if (!sameTarget(target(A.r.sel), target(B.r.sel))) continue;
      const sameMedia = (A.r.media || '') === (B.r.media || '');
      const uniA = A.r.layer.length === 0;
      const uniB = B.r.layer.length === 0;
      let verdict = null;
      if (uniA !== uniB) {
        verdict = 'BROKEN — layered !important beats unlayered !important; the ' + (uniA ? 'unlayered' : 'layered') + ' one dies';
      } else if (!uniA && A.r.layer.join('>') !== B.r.layer.join('>')) {
        verdict = 'RISKY — different layers, !important reverses layer order';
      }
      fights.push({ prop, A, B, sameMedia, verdict });
    }
  }
}

console.log('=== !important FIGHTS (same property, same target) ===');
if (!fights.length) console.log('  none');
for (const f of fights) {
  const A = f.A, B = f.B;
  console.log('  ' + A.r.sel + '  vs  ' + B.r.sel + '   [' + f.prop + ']');
  console.log('    A: ' + A.d.val + ' !important  [' + (A.r.layer.join('>') || '(unlayered)') + '] ' + A.r.file);
  console.log('    B: ' + B.d.val + ' !important  [' + (B.r.layer.join('>') || '(unlayered)') + '] ' + B.r.file);
  console.log('    media: ' + (f.sameMedia ? 'overlap — LIVE FIGHT' : 'exclusive — never both apply'));
  if (f.verdict) console.log('    VERDICT: ' + f.verdict);
}

const seen = new Set();
const singletons = [];
for (const r of imps) {
  if (seen.has(r.sel)) continue;
  const first = r.decls.find((d) => d.imp);
  if (!first) continue;
  seen.add(r.sel);
  singletons.push(r.sel + ' -> ' + first.prop + ': ' + first.val + ' !important [' + (r.layer.join('>') || '(unlayered)') + '] ' + r.file);
}
console.log('\n=== !important SINGLETONS (no rival — safe, often removable) ===');
for (const s of singletons) console.log('  ' + s);

console.log('\n=== totals: ' + imps.length + ' !important rules, ' + fights.length + ' fight pair(s), ' + singletons.length + ' singleton selector(s) ===');
