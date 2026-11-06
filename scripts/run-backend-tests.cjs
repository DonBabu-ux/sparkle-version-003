/**
 * Backend test runner for CI.
 *
 * The `test` script used to list each test file by name. That silently stops
 * covering any test added later — 13 suites had accumulated on disk and were
 * never executed by `npm test` or by the release workflow, including the
 * account-lifecycle, admin-credential, referral and sparkly suites.
 *
 * This globs the real test files so a new suite is covered the moment it
 * lands. Files are named *.test.js / *.test.cjs; load and soak scripts
 * (empirical_capacity_load_test.js, phase2-*, render-saturation.js, ...) are
 * deliberately not matched, since they are harnesses rather than assertions
 * and would hang a normal test run.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testsDir = path.join(__dirname, '..', 'tests');
const allFiles = fs.readdirSync(testsDir)
  .filter((f) => /\.test\.(js|cjs)$/.test(f))
  .sort()
  .map((f) => path.join(testsDir, f));

// A suite that reaches for the database or Redis cannot pass on a bare CI
// runner, which has no backend/.env and no network to alwaysdata. Classify by
// scanning the file rather than by keeping a hand-written list, so a new suite
// is placed correctly the day it lands. When in doubt it is treated as
// integration: being excluded from the pure gate is safe, being wrongly
// included would turn the whole job red.
const needsInfra = (file) => {
  const src = fs.readFileSync(file, 'utf8');
  return (
    /config\/database/.test(src) ||
    /pool\.query/.test(src) ||
    /mysql2/.test(src) ||
    /new Pool\(/.test(src) ||
    /require\(['"]redis['"]\)/.test(src) ||
    /require\(['"]ioredis['"]\)/.test(src) ||
    /require\(['"]\.\.\/backend\/config\/redis/.test(src)
  );
};

// BACKEND_TEST_SCOPE=pure restricts the run to suites that need no database,
// for the always-on CI gate. Default "all" keeps npm test covering everything.
const scope = process.env.BACKEND_TEST_SCOPE || 'all';
const files =
  scope === 'pure' ? allFiles.filter((f) => !needsInfra(f)) : allFiles;

if (files.length === 0) {
  console.error('run-backend-tests: no test files selected (scope=' + scope + ')');
  process.exit(1);
}

if (scope === 'pure') {
  const skipped = allFiles.length - files.length;
  console.log(
    'run-backend-tests: scope=pure, running ' +
      files.length +
      ' standalone suite(s); ' +
      skipped +
      ' integration suite(s) need a database (set DB_* secrets to include them)'
  );
}

console.log('run-backend-tests: ' + files.length + ' suite(s)');
files.forEach((f) => console.log('  ' + path.basename(f)));

const result = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=3', '--test-force-exit', ...files],
  { stdio: 'inherit' }
);

process.exit(result.status === null ? 1 : result.status);
