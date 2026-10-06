#!/usr/bin/env node
// Backend lint gate (FIXES_NEEDED M12): syntax-check every backend JS file.
// eslint has no backend config yet; `node --check` catches parse errors,
// broken template literals, and truncated files without flagging legacy style.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  'server.js',
  'seed-data.js',
  'controllers',
  'middleware',
  'services',
  'utils',
  'workers',
  'jobs',
  'models',
  'routes',
  'config',
  'migrations',
  'socket.js',
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'public', 'dev-dist']);
const files = [];

function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) {
      if (SKIP_DIRS.has(e)) continue;
      walk(path.join(p, e));
    }
  } else if (p.endsWith('.js')) {
    files.push(p);
  }
}

for (const t of TARGETS) {
  const p = path.join(ROOT, t);
  if (fs.existsSync(p)) walk(p);
}

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    process.stderr.write(String(err.stderr || err.message) + '\n');
  }
}

console.log(`lint:backend — ${files.length} files checked, ${failed} failed`);
process.exit(failed ? 1 : 0);
