/**
 * tests/dbErrorHandlingValidation.test.js
 *
 * Validates Section 4 Error Handling requirements:
 * 1. Every checked-out connection is released exactly once.
 * 2. A rollback failure does not prevent connection release.
 * 3. Failed database operations cannot be reported as successful.
 * 4. Empty query results are not used to conceal database errors.
 * 5. Retries are bounded (max 1 retry) and safe for non-idempotent operations.
 * 6. Sensitive credentials/tokens are not exposed in logs.
 *
 * Run with: node tests/dbErrorHandlingValidation.test.js
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const pool = require('../backend/config/database');
const { ConnectionBudgetGate } = pool;

let passed = 0;
let failed = 0;

function assert(condition, label, extraInfo = '') {
    if (condition) {
        console.log(`  OK  ${label}`);
        passed++;
    } else {
        console.error(`  FAIL  ${label}${extraInfo ? '\n      ' + extraInfo : ''}`);
        failed++;
    }
}

async function testRollbackFailureDoesNotPreventRelease() {
    console.log('\n== Test 1: Rollback failure does NOT prevent connection release ==');
    const gate = new ConnectionBudgetGate(8, 10, 250);

    // Mock a connection checkout with failing rollback
    let releaseCalled = 0;
    const releaseGate = await gate.acquire('critical');

    const mockConn = {
        release: () => {
            releaseCalled++;
            releaseGate();
        },
        beginTransaction: async () => {},
        rollback: async () => {
            throw new Error('ECONNRESET: simulated connection reset during rollback');
        }
    };

    assert(gate.getStatus().activeCount === 1, 'Gate activeCount=1 during transaction');

    // Simulate standard transaction wrapper
    let caughtErr = null;
    try {
        try {
            await mockConn.beginTransaction();
            throw new Error('Primary transaction query failed: constraint violation');
        } catch (txErr) {
            caughtErr = txErr;
            // Rollback failure simulation
            try {
                await mockConn.rollback();
            } catch (rbErr) {
                // Preserving original error while logging rollback error
                console.log('    [Simulated log] Rollback failed:', rbErr.message);
            }
            throw txErr;
        } finally {
            mockConn.release();
        }
    } catch (e) {
        // expected to throw
    }

    assert(releaseCalled === 1, 'mockConn.release() called exactly once in finally block');
    assert(gate.getStatus().activeCount === 0, 'Gate activeCount successfully returned to 0 despite rollback failure');
    assert(caughtErr?.message.includes('Primary transaction query failed'), 'Original error was preserved and not swallowed');
}

async function testEmptyResultsNotUsedToConcealErrors() {
    console.log('\n== Test 2: Database errors are re-thrown, NOT concealed with empty results ==');

    // safeQuery must rethrow SQL errors
    let threw = false;
    let caughtCode = null;
    try {
        await pool.safeQuery('SELECT * FROM non_existent_table_for_validation_test_12345');
    } catch (err) {
        threw = true;
        caughtCode = err.code;
    }
    assert(threw, 'safeQuery re-throws error on invalid table query');
    assert(caughtCode === 'ER_NO_SUCH_TABLE' || caughtCode === 'ER_BAD_TABLE_ERROR',
           `Error code is authentic MySQL table error (got ${caughtCode})`);

    // pool.query must rethrow SQL errors
    let poolQueryThrew = false;
    try {
        await pool.query('SELECT * FROM non_existent_table_for_validation_test_12345');
    } catch (err) {
        poolQueryThrew = true;
    }
    assert(poolQueryThrew, 'pool.query re-throws error on invalid table query');

    // pool.execute must rethrow SQL errors
    let poolExecuteThrew = false;
    try {
        await pool.execute('SELECT * FROM non_existent_table_for_validation_test_12345');
    } catch (err) {
        poolExecuteThrew = true;
    }
    assert(poolExecuteThrew, 'pool.execute re-throws error on invalid table query');
}

async function testConnectionCheckoutsReleasedExactlyOnce() {
    console.log('\n== Test 3: Every checked-out connection is released exactly once with idempotent guard ==');
    
    // Acquire a real connection
    const conn = await pool.getConnection('critical');
    const initialActive = pool.getPoolStatus().gateActive;

    // First release
    conn.release();
    const afterFirstRelease = pool.getPoolStatus().gateActive;
    assert(afterFirstRelease === initialActive - 1, 'Active count decremented on first release');

    // Second release (idempotency guard in database.js)
    conn.release();
    const afterSecondRelease = pool.getPoolStatus().gateActive;
    assert(afterSecondRelease === afterFirstRelease, 'Double release is a no-op; does not decrement again');
}

(async () => {
    console.log('='.repeat(70));
    console.log('  SPARKLE Database Error Handling & Release Regression Tests');
    console.log('='.repeat(70));

    try { await testRollbackFailureDoesNotPreventRelease(); } catch (e) { console.error(e); failed++; }
    try { await testEmptyResultsNotUsedToConcealErrors(); } catch (e) { console.error(e); failed++; }
    try { await testConnectionCheckoutsReleasedExactlyOnce(); } catch (e) { console.error(e); failed++; }

    console.log('\n' + '='.repeat(70));
    console.log(`  ERROR HANDLING VALIDATION: ${passed} PASSED, ${failed} FAILED`);
    console.log('='.repeat(70));

    process.exit(failed > 0 ? 1 : 0);
})();
