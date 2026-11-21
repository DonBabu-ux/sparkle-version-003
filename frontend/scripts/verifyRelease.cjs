const fs = require('fs');
const path = require('path');

// Fails the build (prebuild hook) if any VITE_API_URL/API_URL resolves to a
// local/development endpoint. Vite inlines VITE_* vars into the shipped bundle
// at build time, so a loopback value here points production traffic at the
// machine that built it.
function verifyReleaseUrl() {
  const frontendDir = path.resolve(__dirname, '..');
  const invalidPatterns = [
    /localhost/i,
    /127\.0\.0\.1/,
    /10\.0\.2\.2/,
    /192\.168\.\d+\.\d+/,
  ];

  const fail = (where, line) => {
    console.error(`\x1b[31m[BUILD ERROR] Invalid API URL configuration in ${where}:\x1b[0m`);
    console.error(`\x1b[31m  > ${line}\x1b[0m`);
    console.error('\x1b[31mRelease builds are not permitted to use local/development API endpoints!\x1b[0m');
    process.exit(1);
  };

  const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];
  const values = new Map();
  for (const name of envFiles) {
    const filePath = path.join(frontendDir, name);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
    fs.readFileSync(filePath, 'utf8').split('\n').forEach((line) => {
      const match = line.match(/^\s*(?:export\s+)?(VITE_API_URL|API_URL)\s*=\s*(.*?)\s*$/);
      if (!match) return;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values.set(match[1], { where: `${name}: ${match[1]}`, value });
    });
  }

  // Shell environment variables take precedence over all env files.
  for (const key of ['VITE_API_URL', 'API_URL']) {
    const value = process.env[key];
    if (value) values.set(key, { where: `process.env.${key}`, value });
  }

  for (const { where, value } of values.values()) {
    if (invalidPatterns.some((pattern) => pattern.test(value))) fail(where, `${where}=${value}`);
  }

  console.log(
    '\x1b[32m[BUILD CHECK] Effective production API URLs verified.\x1b[0m'
  );
}

// Guards the slimmer-APK PWA removal: VitePWA is disabled via
// VITE_PWA_DISABLE=true, and if the flag is ever dropped from the build
// command (bare `npx cap sync`, CI without the var, a hand-rolled gradlew
// run) the SW + manifest would silently return to the bundle and the WebView
// would precache ~8MB of the assets it is already served locally.
// This runs as `prebuild` on every `vite build`, so the assert is one step
// upstream of the regression. Inspecting the *previous* build's dist is the
// earliest point where the artifacts exist.
function verifyNoPwaArtifacts() {
  const distDir = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) return; // first-ever build: nothing to check yet

  const offenders = [];
  // Exact-name service workers plus the hash-suffixed forms VitePWA emits
  // (`registerSW.abc123.js`, `sw.js`, `worker-abc123.js`, `workbox-abc123.js`).
  // Matching uses an explicit stem + hash-shaped suffix, NOT a substring test:
  // ordinary chunks end in `-BgJflSWk.js` (hash after a dash) and must not
  // trip the guard — that would fail a perfectly valid APK build.
  const swStems = ['registersw', 'sw', 'service-worker', 'serviceworker', 'worker', 'workbox'];

  const isHashedAssetName = (lower) =>
    // vite emits `<name>-<hash>.<ext>`; the hash always sits between a dash
    // and the extension, so `link-2-BgJflSWk.js` is hashed, `BgJflSWk.js` is not.
    /^[a-z0-9]+-[a-z0-9_-]{6,}\.[a-z]+$/.test(lower);

  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), relPath);
        continue;
      }
      const lower = entry.name.toLowerCase();
      const stem = lower.split('.')[0]; // drop all extensions
      const bareStem = stem.replace(/-[a-z0-9_-]{6,}$/, ''); // strip a trailing hash
      if (swStems.includes(bareStem) || swStems.includes(stem)) {
        offenders.push(relPath);
      }
      if (lower === 'manifest.webmanifest' || lower === 'manifest.json') {
        offenders.push(relPath);
      }
      if (isHashedAssetName(lower) && swStems.includes(bareStem)) {
        offenders.push(relPath);
      }
    }
  };
  walk(distDir);

  const indexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    const html = fs.readFileSync(indexHtml, 'utf8');
    if (/registerSW\.js|manifest\.webmanifest/i.test(html)) {
      offenders.push('index.html (references a service worker / manifest)');
    }
  }

  if (offenders.length > 0) {
    console.error('\x1b[31m[BUILD ERROR] PWA artifacts found in frontend/dist:\x1b[0m');
    offenders.forEach((f) => console.error(`\x1b[31m  > ${f}\x1b[0m`));
    console.error(
      '\x1b[31mThe APK WebView must not ship a service worker (it re-caches ~8MB of assets ' +
        'already bundled locally and slows cold start).\x1b[0m'
    );
    console.error(
      '\x1b[31mBuild with VITE_PWA_DISABLE=true — e.g. the "build:apk" script, which sets it ' +
        'before cap sync.\x1b[0m'
    );
    process.exit(1);
  }

  console.log('\x1b[32m[BUILD CHECK] No service-worker/PWA artifacts in dist.\x1b[0m');
}

verifyReleaseUrl();
verifyNoPwaArtifacts();
