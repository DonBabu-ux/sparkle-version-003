/**
 * Type-error gate for CI.
 *
 * tsc currently reports 161 errors left over from before the frontend was
 * opened up. Turning tsc into a hard gate today would fail on every PR and
 * get switched off, so this enforces the useful thing instead: no NEW type
 * errors. Fixing an error is always allowed; adding one is not.
 *
 * Errors are keyed by file + TS code and counted, not by line/column, because
 * deleting an error on line 40 shifts every error after it and would otherwise
 * look like a wave of new ones.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..');
const baselinePath = path.join(frontendDir, '.tsc-baseline.txt');

const result = spawnSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.app.json', '--noEmit'],
  { cwd: frontendDir, encoding: 'utf8' }
);

const out = String(result.stdout || '') + String(result.stderr || '');
const ERROR_RE = /^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/gm;

const counts = new Map();
let match;
while ((match = ERROR_RE.exec(out)) !== null) {
  const key = match[1] + ' :: ' + match[5];
  counts.set(key, (counts.get(key) || 0) + 1);
}

const total = [...counts.values()].reduce((a, b) => a + b, 0);

if (!fs.existsSync(baselinePath)) {
  const lines = [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, n]) => k + (n > 1 ? ' x' + n : ''));
  fs.writeFileSync(baselinePath, lines.join('\n') + '\n', 'utf8');
  console.log('typecheck-gate: established baseline of ' + total + ' existing type error(s) in ' + counts.size + ' file(s).');
  console.log('  Written to ' + path.relative(process.cwd(), baselinePath) + ' — commit it so the gate travels with the repo.');
  process.exit(0);
}

const baseline = new Map();
fs.readFileSync(baselinePath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .forEach((line) => {
    const m = line.match(/^(.*?)(?: x(\d+))?$/);
    const key = m[1];
    const n = m[2] ? parseInt(m[2], 10) : 1;
    baseline.set(key, (baseline.get(key) || 0) + n);
  });

const baselineTotal = [...baseline.values()].reduce((a, b) => a + b, 0);
const introduced = [];
for (const [key, n] of counts.entries()) {
  const allowed = baseline.get(key) || 0;
  if (n > allowed) {
    introduced.push('  ' + (n - allowed) + 'x ' + key);
  }
}

if (introduced.length > 0) {
  console.error('typecheck-gate: FAILED — ' + total + ' type error(s), baseline ' + baselineTotal);
  console.error('New type errors (not present in the baseline):');
  introduced.forEach((l) => console.error(l));
  console.error('');
  console.error('Fix these, or lower the baseline in .tsc-baseline.txt once you have deliberately accepted them.');
  process.exit(1);
}

const fixed = baselineTotal - total;
console.log(
  'typecheck-gate: PASS — ' +
    total +
    ' type error(s), at or below the ' +
    baselineTotal +
    ' recorded baseline' +
    (fixed > 0 ? ' (' + fixed + ' fewer — nice.)' : '') +
    '.'
);
