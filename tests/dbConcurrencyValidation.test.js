/**
 * tests/dbConcurrencyValidation.test.js
 *
 * Deterministic concurrency validation for ConnectionBudgetGate.
 * Tests the real production ConnectionBudgetGate imported from backend/config/database.
 *
 * Validates:
 *  1. Eight normal operations occupy eight slots.
 *  2. A ninth normal operation waits in queue.
 *  3. Two eligible critical operations can use the reserve (slots 9 & 10).
 *  4. Normal operations cannot consume the reserve.
 *  5. Timed-out and cancelled waiters are removed safely (including Promise.race cancellation).
 *  6. Connections and counters return to baseline after success, failure, timeout, and rollback.
 *  7. Queue saturation fails predictably with POOL_QUEUE_EXHAUSTED without leaks or unhandled rejections.
 *  8. Double-release idempotency.
 *
 * Run with: node tests/dbConcurrencyValidation.test.js
 */

'use strict';

const { ConnectionBudgetGate } = require('../backend/config/database');

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

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ── Scenario 1: Normal 8-slot budget & 9th waiter ────────────────────────────
async function testNormalBudgetAndNinthWaiter() {
    console.log('\n== Scenario 1: Eight normal slots occupied, 9th normal waits ==');
    const gate = new ConnectionBudgetGate(8, 10, 250);

    const normalReleases = [];
    for (let i = 0; i < 8; i++) {
        normalReleases.push(await gate.acquire(false, 0));
    }

    const s1 = gate.getStatus();
    assert(s1.activeCount === 8, 'Eight normal operations occupy 8 slots', `got ${s1.activeCount}`);
    assert(s1.totalQueued === 0, 'Initial queue is empty', `got ${s1.totalQueued}`);

    // 9th normal operation waits
    let ninthResolved = false;
    let ninthTimedOut = false;
    const ninthPromise = gate.acquire(false, 150)
        .then(rel => { ninthResolved = true; return rel; })
        .catch(err => {
            if (err.code === 'CONNECTION_ACQUISITION_TIMEOUT') ninthTimedOut = true;
        });

    await sleep(20);
    const s2 = gate.getStatus();
    assert(s2.activeCount === 8, 'activeCount remains 8 while 9th waits', `got ${s2.activeCount}`);
    assert(s2.normalQueueLength === 1, '9th normal operation is waiting in queue', `got ${s2.normalQueueLength}`);
    assert(!ninthResolved, '9th normal operation has not resolved yet');

    // Wait for the 9th to time out
    await ninthPromise;
    assert(ninthTimedOut, '9th normal waiter timed out with CONNECTION_ACQUISITION_TIMEOUT');

    const s3 = gate.getStatus();
    assert(s3.activeCount === 8, 'activeCount still 8 after timeout (no drift)', `got ${s3.activeCount}`);
    assert(s3.totalQueued === 0, 'Queue is drained after timeout', `got ${s3.totalQueued}`);

    // Release the 8 active slots
    for (const rel of normalReleases) rel();
    await sleep(10);

    const s4 = gate.getStatus();
    assert(s4.activeCount === 0, 'activeCount returns to 0 baseline after release', `got ${s4.activeCount}`);
    assert(s4.totalQueued === 0, 'totalQueued is 0 at baseline', `got ${s4.totalQueued}`);
}

// ── Scenario 2: Two critical operations use the peak reserve (slots 9 & 10) ───
async function testPeakReserve() {
    console.log('\n== Scenario 2: Critical operations use peak reserve (slots 9 & 10) ==');
    const gate = new ConnectionBudgetGate(8, 10, 250);

    const normalReleases = [];
    for (let i = 0; i < 8; i++) {
        normalReleases.push(await gate.acquire(false, 0));
    }

    // Critical operations can use slots 9 and 10
    const peakRel1 = await gate.acquire('critical', 0);
    const s1 = gate.getStatus();
    assert(s1.activeCount === 9, 'Critical operation takes slot 9', `got ${s1.activeCount}`);
    assert(s1.peakActiveCount === 1, 'peakActiveCount is 1', `got ${s1.peakActiveCount}`);

    const peakRel2 = await gate.acquire('auth:login', 0);
    const s2 = gate.getStatus();
    assert(s2.activeCount === 10, 'Second critical operation takes slot 10', `got ${s2.activeCount}`);
    assert(s2.peakActiveCount === 2, 'peakActiveCount is 2', `got ${s2.peakActiveCount}`);

    // Normal operation CANNOT consume the reserve
    let normalCanAcquire = false;
    const normalPromise = gate.acquire(false, 100)
        .then(rel => { normalCanAcquire = true; rel(); })
        .catch(err => err);

    await sleep(20);
    const s3 = gate.getStatus();
    assert(s3.normalQueueLength === 1, 'Normal operation cannot use reserve; queued instead', `got ${s3.normalQueueLength}`);
    assert(!normalCanAcquire, 'Normal operation did not acquire reserve slot');

    await normalPromise; // wait for timeout

    // 11th operation (even critical) must wait because pool has hard ceiling of 10
    let eleventhTimedOut = false;
    await gate.acquire('critical', 100).catch(err => {
        if (err.code === 'CONNECTION_ACQUISITION_TIMEOUT') eleventhTimedOut = true;
    });
    assert(eleventhTimedOut, '11th operation waits and times out (hard ceiling 10 respected)');

    // Release peak slots
    peakRel1();
    peakRel2();
    await sleep(10);

    const s4 = gate.getStatus();
    assert(s4.peakActiveCount === 0, 'peakActiveCount returns to 0 after peak releases', `got ${s4.peakActiveCount}`);
    assert(s4.activeCount === 8, 'activeCount returns to 8', `got ${s4.activeCount}`);

    // Release normal slots
    for (const rel of normalReleases) rel();
    await sleep(10);

    const s5 = gate.getStatus();
    assert(s5.activeCount === 0, 'activeCount returns to 0 baseline after all releases', `got ${s5.activeCount}`);
    assert(s5.totalQueued === 0, 'totalQueued is 0', `got ${s5.totalQueued}`);
}

// ── Scenario 3: Promise.race cancellation & leak prevention ──────────────────
async function testPromiseRaceCancellation() {
    console.log('\n== Scenario 3: Promise.race blocked 9th acquisition does NOT leak connection ==');
    const gate = new ConnectionBudgetGate(8, 10, 250);

    const normalReleases = [];
    for (let i = 0; i < 8; i++) {
        normalReleases.push(await gate.acquire(false, 0));
    }
    assert(gate.getStatus().activeCount === 8, '8 slots occupied');

    // Case A: Outer timeout races against gate.acquire using AbortController
    const ac = new AbortController();
    let raceTimedOut = false;
    const raceTimer = new Promise((_, reject) => {
        setTimeout(() => {
            raceTimedOut = true;
            ac.abort(); // Cancel the underlying acquire!
            reject(new Error('Outer race timeout'));
        }, 80);
    });

    const pendingAcquire = gate.acquire(false, 5000, { signal: ac.signal });

    await Promise.race([pendingAcquire, raceTimer]).catch(() => {});
    assert(raceTimedOut, 'Outer race timeout fired');

    // Waiter must be removed from queue via abort signal
    await sleep(20);
    const s1 = gate.getStatus();
    assert(s1.totalQueued === 0, 'Aborted waiter safely removed from queue', `got ${s1.totalQueued}`);
    assert(s1.activeCount === 8, 'activeCount still 8', `got ${s1.activeCount}`);

    // Now release all 8 occupied connections!
    // If the 9th acquisition was leaked, releasing the 8 connections would trigger
    // the 9th acquisition in the background and increment activeCount to 1!
    for (const rel of normalReleases) rel();
    await sleep(30);

    const s2 = gate.getStatus();
    assert(s2.activeCount === 0, 'Cancelled acquisition NEVER obtained connection; activeCount=0', `got ${s2.activeCount}`);
    assert(s2.totalQueued === 0, 'Queue is empty after releases', `got ${s2.totalQueued}`);

    // Case B: Testing .cancel() method on the returned promise
    for (let i = 0; i < 8; i++) {
        normalReleases[i] = await gate.acquire(false, 0);
    }
    const cancelAcquire = gate.acquire(false, 5000);
    cancelAcquire.catch(() => {}); // Expected rejection on cancellation
    assert(gate.getStatus().normalQueueLength === 1, 'Waiter queued');

    // Cancel manually
    cancelAcquire.cancel();
    await sleep(10);
    assert(gate.getStatus().normalQueueLength === 0, 'Waiter removed immediately on .cancel()');

    for (const rel of normalReleases) rel();
    await sleep(20);
    assert(gate.getStatus().activeCount === 0, 'activeCount returned cleanly to 0 after .cancel()');
}

// ── Scenario 4: Counter baseline after Success, Failure, Timeout & Rollback ───
async function testBaselineReturnOnErrorsAndRollback() {
    console.log('\n== Scenario 4: Counters return to baseline after Success, Failure, Timeout, and Rollback ==');
    const gate = new ConnectionBudgetGate(8, 10, 250);

    // 1. Success path
    const rel1 = await gate.acquire(false, 1000);
    assert(gate.getStatus().activeCount === 1, 'Success acquire incremented counter to 1');
    rel1();
    assert(gate.getStatus().activeCount === 0, 'Success release returned counter to 0');

    // 2. Failure path with simulated rollback
    async function simulateFailingTransaction() {
        const releaseSlot = await gate.acquire('critical', 1000);
        try {
            // Simulate transaction failure
            throw new Error('Transaction query failed: Deadlock found');
        } catch (err) {
            // Simulate rollback (even if rollback fails)
            try {
                // simulate rollback
            } catch (_) {}
            throw err;
        } finally {
            releaseSlot();
        }
    }

    let threw = false;
    try {
        await simulateFailingTransaction();
    } catch (e) {
        threw = true;
    }
    assert(threw, 'Failing transaction threw as expected');
    assert(gate.getStatus().activeCount === 0, 'activeCount returned to 0 after transaction failure & rollback');
    assert(gate.getStatus().peakActiveCount === 0, 'peakActiveCount returned to 0');

    // 3. Timeout path
    const fills = [];
    for (let i = 0; i < 8; i++) fills.push(await gate.acquire(false, 0));
    let timeoutCaught = false;
    try {
        await gate.acquire(false, 50);
    } catch (e) {
        if (e.code === 'CONNECTION_ACQUISITION_TIMEOUT') timeoutCaught = true;
    }
    assert(timeoutCaught, 'Timeout caught cleanly');
    assert(gate.getStatus().activeCount === 8, 'activeCount remains 8 after timeout');
    for (const rel of fills) rel();
    await sleep(10);
    assert(gate.getStatus().activeCount === 0, 'activeCount returns to 0 after timeout + releases');
}

// ── Scenario 5: Queue saturation without leaks or unhandled rejections ────────
async function testQueueSaturation() {
    console.log('\n== Scenario 5: Queue saturation (maxQueue=3) fails predictably ==');
    const gate = new ConnectionBudgetGate(2, 4, 3); // normal=2, max=4, maxQueue=3

    const r1 = await gate.acquire(false, 0);
    const r2 = await gate.acquire(false, 0);

    // Queue 3 waiters (fills maxQueue=3)
    const qPromises = [
        gate.acquire(false, 2000),
        gate.acquire(false, 2000),
        gate.acquire(false, 2000)
    ];
    await sleep(10);
    assert(gate.getStatus().totalQueued === 3, 'Queue filled to exactly maxQueue=3', `got ${gate.getStatus().totalQueued}`);

    // 4th waiter must be immediately rejected with POOL_QUEUE_EXHAUSTED
    let queueFullErr = null;
    try {
        await gate.acquire(false, 2000);
    } catch (e) {
        queueFullErr = e;
    }
    assert(queueFullErr !== null, '4th waiter rejected immediately');
    assert(queueFullErr?.code === 'POOL_QUEUE_EXHAUSTED', 'Error code is POOL_QUEUE_EXHAUSTED', `got ${queueFullErr?.code}`);
    assert(queueFullErr?.status === 503, 'HTTP status is 503', `got ${queueFullErr?.status}`);
    assert(gate.getStatus().totalQueued === 3, 'Queue length remains capped at 3');

    // Release active slots — queued waiters should be promoted smoothly
    r1();
    r2();
    await sleep(20);

    const releases = await Promise.all(qPromises.slice(0, 2));
    assert(gate.getStatus().activeCount === 2, '2 queued waiters promoted to active', `got ${gate.getStatus().activeCount}`);

    // Release remaining
    for (const rel of releases) rel();
    const lastRel = await qPromises[2];
    lastRel();
    await sleep(10);

    assert(gate.getStatus().activeCount === 0, 'All promoted waiters released; activeCount=0');
    assert(gate.getStatus().totalQueued === 0, 'Queue completely empty; totalQueued=0');
}

// ── Scenario 6: Double-release idempotency ────────────────────────────────────
async function testDoubleReleaseIdempotency() {
    console.log('\n== Scenario 6: Double-release does not corrupt activeCount ==');
    const gate = new ConnectionBudgetGate(8, 10, 250);

    const rel = await gate.acquire(false, 0);
    assert(gate.getStatus().activeCount === 1, 'Acquired 1 slot');

    rel(); // 1st release
    rel(); // 2nd release
    rel(); // 3rd release
    await sleep(5);

    assert(gate.getStatus().activeCount === 0, 'activeCount stays 0 without underflow on multiple releases',
           `got ${gate.getStatus().activeCount}`);
}

// ── Runner ────────────────────────────────────────────────────────────────────
(async () => {
    console.log('='.repeat(70));
    console.log('  SPARKLE ConnectionBudgetGate: Deterministic Concurrency Validation');
    console.log('='.repeat(70));

    try { await testNormalBudgetAndNinthWaiter(); } catch (e) { console.error('Scenario 1 error:', e); failed++; }
    try { await testPeakReserve(); } catch (e) { console.error('Scenario 2 error:', e); failed++; }
    try { await testPromiseRaceCancellation(); } catch (e) { console.error('Scenario 3 error:', e); failed++; }
    try { await testBaselineReturnOnErrorsAndRollback(); } catch (e) { console.error('Scenario 4 error:', e); failed++; }
    try { await testQueueSaturation(); } catch (e) { console.error('Scenario 5 error:', e); failed++; }
    try { await testDoubleReleaseIdempotency(); } catch (e) { console.error('Scenario 6 error:', e); failed++; }

    console.log('\n' + '='.repeat(70));
    console.log(`  CONCURRENCY VALIDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('='.repeat(70));

    process.exit(failed > 0 ? 1 : 0);
})();
