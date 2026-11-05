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
const files = fs.readdirSync(testsDir)
  .filter((f) => /\.test\.(js|cjs)$/.test(f))
  .sort()
  .map((f) => path.join(testsDir, f));

if (files.length === 0) {
  console.error('run-backend-tests: no test files found in tests/');
  process.exit(1);
}

console.log('run-backend-tests: ' + files.length + ' suite(s)');
files.forEach((f) => console.log('  ' + path.basename(f)));

const result = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=3', '--test-force-exit', ...files],
  { stdio: 'inherit' }
);

process.exit(result.status === null ? 1 : result.status);
