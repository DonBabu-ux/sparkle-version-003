#!/usr/bin/env node
// Wrapper for the APK web build: runs `vite build` with VITE_PWA_DISABLE=true
// so the service worker and manifest are never emitted into the bundle that
// `cap sync` copies into the WebView assets.
//
// Why a wrapper instead of `VITE_PWA_DISABLE=true vite build` in package.json:
// npm run executes on cmd.exe on Windows (where `VAR=x cmd` syntax fails) and
// sh everywhere else. A node script sets process.env before spawning Vite and
// is shell-agnostic — the value reaches Vite through defineConfig's
// process.env read regardless of which shell invoked npm.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

// npx resolves node_modules/.bin; spawn the local vite binary directly so we
// never depend on npx being on PATH.
const viteBin = path.join(
  frontendDir,
  'node_modules',
  '.bin',
  isWindows ? 'vite.cmd' : 'vite'
);

const result = spawnSync(viteBin, ['build'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: isWindows, // .cmd shims need a shell on Windows
  env: { ...process.env, VITE_PWA_DISABLE: 'true' },
});

if (result.status !== 0) {
  console.error(`\x1b[31m[BUILD ERROR] vite build exited with ${result.status}\x1b[0m`);
  process.exit(result.status === null ? 1 : result.status);
}

// Assert the flag took effect, against the artifacts THIS build produced.
// Deliberately not a prebuild hook: `npm run build` (the OTA path) uses the
// same dist dir and legitimately emits a service worker, so a prebuild walk
// would fail that build on its predecessor's artifacts.
function verifyNoPwaArtifacts() {
  const distDir = path.join(frontendDir, 'dist');
  if (!fs.existsSync(distDir)) return; // vite failed to emit anything; the status check above covers it

  const offenders = [];
  const swStems = ['registersw', 'sw', 'service-worker', 'serviceworker', 'worker', 'workbox'];

  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), relPath);
        continue;
      }
      const lower = entry.name.toLowerCase();
      const stem = lower.split('.')[0];
      // vite emits `<name>-<hash>.<ext>`; strip a trailing hash so ordinary
      // chunks (`link-2-BgJflSWk.js`) are not mistaken for a service worker.
      const bareStem = stem.replace(/-[a-z0-9_-]{6,}$/, '');
      if (swStems.includes(bareStem) || swStems.includes(stem)) offenders.push(relPath);
      if (lower === 'manifest.webmanifest' || lower === 'manifest.json') offenders.push(relPath);
    }
  };
  walk(distDir);

  const indexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtml) && /registerSW\.js|manifest\.webmanifest/i.test(fs.readFileSync(indexHtml, 'utf8'))) {
    offenders.push('index.html (references a service worker / manifest)');
  }

  if (offenders.length > 0) {
    console.error('\x1b[31m[BUILD ERROR] PWA artifacts found in frontend/dist:\x1b[0m');
    offenders.forEach((f) => console.error(`\x1b[31m  > ${f}\x1b[0m`));
    console.error('\x1b[31mVITE_PWA_DISABLE=true did not suppress the service worker.\x1b[0m');
    process.exit(1);
  }
  console.log('\x1b[32m[BUILD CHECK] No service-worker/PWA artifacts in dist.\x1b[0m');
}

verifyNoPwaArtifacts();