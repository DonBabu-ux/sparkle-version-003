const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const db = require(path.join(__dirname, '../backend/config/database'));

function computePercentiles(latencies) {
    if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
    const sorted = [...latencies].sort((a, b) => a - b);
    const p = (pct) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))];
    const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    return {
        min: sorted[0],
        p50: p(0.50),
        p95: p(0.95),
        p99: p(0.99),
        max: sorted[sorted.length - 1],
        avg: Math.round(avg * 10) / 10
    };
}

async function runProfile({ name, totalRequests, concurrency, isCritical, delayBetweenBatchesMs }) {
    console.log(`\n======================================================`);
    console.log(`Running Profile: ${name}`);
    console.log(`Total Requests: ${totalRequests}, Concurrency: ${concurrency}, Critical: ${isCritical}`);
    console.log(`======================================================`);

    const latencies = [];
    const waitTimes = [];
    let successes = 0;
    let timeouts = 0;
    let queueExhausted = 0;
    let errors = 0;

    const tStart = Date.now();
    let requestIndex = 0;

    async function executeOne() {
        const reqId = ++requestIndex;
        const tReqStart = Date.now();
        try {
            // Priority is passed to pool.query (priority = true/critical or false)
            const [rows] = await db.query(
                'SELECT 1 as ping, NOW() as server_now, ? as req_id',
                [reqId],
                isCritical ? 'critical' : false
            );
            const dur = Date.now() - tReqStart;
            latencies.push(dur);
            successes++;
        } catch (err) {
            const dur = Date.now() - tReqStart;
            latencies.push(dur);
            if (err.code === 'CONNECTION_ACQUISITION_TIMEOUT') {
                timeouts++;
            } else if (err.code === 'POOL_QUEUE_EXHAUSTED') {
                queueExhausted++;
            } else {
                errors++;
            }
        }
    }

    // Run in concurrent worker workers
    const activeWorkers = [];
    let completed = 0;

    async function worker() {
        while (completed < totalRequests) {
            completed++;
            await executeOne();
            if (delayBetweenBatchesMs > 0) {
                await new Promise(r => setTimeout(r, delayBetweenBatchesMs));
            }
        }
    }

    for (let c = 0; c < concurrency; c++) {
        activeWorkers.push(worker());
    }

    await Promise.all(activeWorkers);
    const totalDurationMs = Date.now() - tStart;
    const throughputRps = (successes / (totalDurationMs / 1000)).toFixed(2);
    const stats = computePercentiles(latencies);
    const poolStatus = db.getPoolStatus();

    console.log(`Duration: ${totalDurationMs}ms`);
    console.log(`Throughput: ${throughputRps} req/sec`);
    console.log(`Successes: ${successes}/${totalRequests}`);
    console.log(`Timeouts: ${timeouts}, Queue Full: ${queueExhausted}, Errors: ${errors}`);
    console.log(`Latency: p50=${stats.p50}ms, p95=${stats.p95}ms, p99=${stats.p99}ms, avg=${stats.avg}ms, max=${stats.max}ms`);
    console.log(`Gate snapshot:`, JSON.stringify(poolStatus));

    return {
        name,
        totalRequests,
        concurrency,
        durationMs: totalDurationMs,
        throughputRps: parseFloat(throughputRps),
        successes,
        timeouts,
        queueExhausted,
        errors,
        latency: stats,
        gateStatus: poolStatus
    };
}

async function main() {
    console.log('SPARKLE DATABASE CAPACITY BENCHMARK & GATE STRESS TEST');
    console.log('Testing against active pool with 8 normal + 2 peak budget (total 10)');

    // Warm pool
    await db.query('SELECT 1');

    // 1. Profile 1: Ordinary Traffic (Normal workload, 5 concurrent workers, 40 total requests)
    const normalResult = await runProfile({
        name: 'Profile 1: Ordinary Traffic (Normal 8-Slot Budget)',
        totalRequests: 40,
        concurrency: 5,
        isCritical: false,
        delayBetweenBatchesMs: 20
    });

    // 2. Profile 2: Critical Traffic (Auth & Wallet peak reserve, 8 concurrent workers, 40 total requests)
    const criticalResult = await runProfile({
        name: 'Profile 2: Critical Operations (Peak Reserve Access)',
        totalRequests: 40,
        concurrency: 8,
        isCritical: true,
        delayBetweenBatchesMs: 15
    });

    // 3. Profile 3: Spike Traffic (Saturation burst, 25 concurrent requests hitting 10-connection wall)
    const spikeResult = await runProfile({
        name: 'Profile 3: Traffic Spike (Saturation burst beyond 10-connection limit)',
        totalRequests: 50,
        concurrency: 25,
        isCritical: false,
        delayBetweenBatchesMs: 0
    });

    console.log('\n======================================================');
    console.log('ALL PROFILES COMPLETED. Summary:');
    console.log('======================================================');
    console.table([
        {
            Profile: normalResult.name.split(':')[0],
            Requests: normalResult.totalRequests,
            Success: normalResult.successes,
            Throughput: `${normalResult.throughputRps} rps`,
            p50: `${normalResult.latency.p50}ms`,
            p95: `${normalResult.latency.p95}ms`,
            p99: `${normalResult.latency.p99}ms`,
            Timeouts: normalResult.timeouts,
            Errors: normalResult.errors
        },
        {
            Profile: criticalResult.name.split(':')[0],
            Requests: criticalResult.totalRequests,
            Success: criticalResult.successes,
            Throughput: `${criticalResult.throughputRps} rps`,
            p50: `${criticalResult.latency.p50}ms`,
            p95: `${criticalResult.latency.p95}ms`,
            p99: `${criticalResult.latency.p99}ms`,
            Timeouts: criticalResult.timeouts,
            Errors: criticalResult.errors
        },
        {
            Profile: spikeResult.name.split(':')[0],
            Requests: spikeResult.totalRequests,
            Success: spikeResult.successes,
            Throughput: `${spikeResult.throughputRps} rps`,
            p50: `${spikeResult.latency.p50}ms`,
            p95: `${spikeResult.latency.p95}ms`,
            p99: `${spikeResult.latency.p99}ms`,
            Timeouts: spikeResult.timeouts,
            Errors: spikeResult.errors
        }
    ]);

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal load test error:', err);
    process.exit(1);
});
