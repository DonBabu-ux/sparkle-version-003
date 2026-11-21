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

process.exit(result.status === null ? 1 : result.status);