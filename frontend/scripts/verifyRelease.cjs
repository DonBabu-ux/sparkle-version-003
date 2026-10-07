const fs = require('fs');
const path = require('path');

// Fails the build (prebuild hook) if any VITE_API_URL/API_URL resolves to a
// local/development endpoint. Vite inlines VITE_* vars into the shipped bundle
// at build time, so a loopback value here points production traffic at the
// machine that built it (UI_AUDIT P0 #19 — .env.local escaped this guard
// until 2026-10-07 because only .env/.env.production were scanned).
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

  const checkLine = (where, line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) return;
    if (trimmed.startsWith('VITE_API_URL') || trimmed.startsWith('API_URL')) {
      for (const pattern of invalidPatterns) {
        if (pattern.test(trimmed)) fail(where, trimmed);
      }
    }
  };

  // 1. Every env file Vite may load (.env, .env.local, .env.production,
  //    .env.production.local, .env.development.local, ...) — priority order
  //    does not matter: any offender fails the build.
  const envFiles = fs
    .readdirSync(frontendDir)
    .filter((name) => name === '.env' || name.startsWith('.env.'));
  for (const name of envFiles) {
    const filePath = path.join(frontendDir, name);
    if (!fs.statSync(filePath).isFile()) continue;
    fs.readFileSync(filePath, 'utf8').split('\n').forEach((line, i) => {
      checkLine(`${name}:${i + 1}`, line);
    });
  }

  // 2. Real environment variables (CI/CD shell env beats .env files in Vite).
  for (const key of ['VITE_API_URL', 'API_URL']) {
    const value = process.env[key];
    if (value && invalidPatterns.some((p) => p.test(value))) {
      fail(`process.env.${key}`, `${key}=${value}`);
    }
  }

  console.log(
    `\x1b[32m[BUILD CHECK] API URLs verified for production release (${envFiles.length} env file(s) + shell env scanned).\x1b[0m`
  );
}

verifyReleaseUrl();
