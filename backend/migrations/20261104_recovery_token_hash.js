/**
 * Migration: 20261104_recovery_token_hash.js
 *
 * accountRecovery.service.js has always stored only a SHA-256 hash of the
 * recovery token (see the "Store only a hash" comment on verifyChallenge),
 * and every read path matches on verified_token_hash. The column was added
 * by 20261013_data_centre_and_recovery.js, but there is no migration runner
 * in this repo, so that migration never ran on the live database. The
 * account_recovery_requests table has the old plaintext `verified_token`
 * column and no `verified_token_hash`.
 *
 * Consequence on production: verifyChallenge's UPDATE raises
 * "Unknown column 'verified_token_hash'", so no user can complete an account
 * recovery. Discovered by the data-centre suite, which had been excluded
 * from the release gate and so never ran.
 *
 * Idempotent: safe to re-run. The legacy plaintext column is left in place
 * and unused rather than dropped, so a rollback of this change cannot lose
 * data.
 */
require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

async function addColumn(ddl) {
  try {
    await pool.query(ddl);
    return 'added';
  } catch (e) {
    if (String(e.code || '') === 'ER_DUP_FIELD' || e.errno === 1060) return 'already present';
    throw e;
  }
}

async function addIndex(ddl) {
  try {
    await pool.query(ddl);
    return 'added';
  } catch (e) {
    if (String(e.code || '') === 'ER_DUP_KEY' || e.errno === 1061) return 'already present';
    throw e;
  }
}

async function up() {
  logger.info('[Migration] 20261104_recovery_token_hash: ensuring verified_token_hash column');
  const [cols] = await pool.query('SHOW COLUMNS FROM account_recovery_requests');
  const names = cols.map((c) => c.Field);
  console.log('columns before: ' + names.join(', '));

  const colResult = await addColumn(
    'ALTER TABLE account_recovery_requests ADD COLUMN verified_token_hash VARCHAR(128) DEFAULT NULL'
  );
  console.log('verified_token_hash: ' + colResult);

  const idxResult = await addIndex(
    'CREATE INDEX idx_recovery_token_hash ON account_recovery_requests (verified_token_hash)'
  );
  console.log('idx_recovery_token_hash: ' + idxResult);

  const [after] = await pool.query('SHOW COLUMNS FROM account_recovery_requests');
  console.log('columns after: ' + after.map((c) => c.Field).join(', '));
  console.log('verified_token_hash present: ' + after.some((c) => c.Field === 'verified_token_hash'));
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => { console.error('MIGRATION FAILED: ' + (err.code || '') + ' ' + err.message); process.exit(1); });
}

module.exports = up;
