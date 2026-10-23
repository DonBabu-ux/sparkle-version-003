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

verifyReleaseUrl();
