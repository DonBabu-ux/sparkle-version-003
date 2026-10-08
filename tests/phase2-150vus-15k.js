import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// ============================================================
// SPARKLE PHASE 2
// 150 VUs  100 ITERATIONS = EXACTLY 15,000 REQUESTS
// LOCAL READ-ONLY CAPACITY TEST
// ============================================================

const BASE_URL = 'http://localhost:3000';

// ------------------------------------------------------------
// CUSTOM METRICS
// ------------------------------------------------------------

const sparkleRequests = new Counter('sparkle_requests');
const sparkle2xx = new Counter('sparkle_2xx');
const sparkle3xx = new Counter('sparkle_3xx');
const sparkle4xx = new Counter('sparkle_4xx');
const sparkle5xx = new Counter('sparkle_5xx');
const sparkleTimeouts = new Counter('sparkle_timeouts');
const sparkleCapacityFailures = new Counter(
    'sparkle_capacity_failures'
);

const sparkleLatency = new Trend('sparkle_latency');

// ------------------------------------------------------------
// TEST CONFIGURATION
// ------------------------------------------------------------

export const options = {
    scenarios: {
        sparkle_150_users: {
            executor: 'per-vu-iterations',

            // EXACTLY 150 concurrent VUs
            vus: 150,

            // EXACTLY 100 iterations per VU
            iterations: 100,

            maxDuration: '10m',
        },
    },

    thresholds: {
        http_req_duration: [
            'p(95)<1500',
            'p(99)<3000',
        ],

        // Genuine infrastructure failures only.
        sparkle_capacity_failures: [
            'count<100',
        ],

        sparkle_timeouts: [
            'count<10',
        ],
    },

    summaryTrendStats: [
        'avg',
        'min',
        'med',
        'max',
        'p(90)',
        'p(95)',
        'p(99)',
    ],
};

// ------------------------------------------------------------
// SAFE READ ROUTES
//
// START WITH HEALTH ONLY.
// Add additional confirmed-safe GET endpoints later.
// ------------------------------------------------------------

const READ_ROUTES = [
    '/api/health',
];

// ------------------------------------------------------------
// MAIN TEST
// ------------------------------------------------------------

export default function () {

    if (READ_ROUTES.length === 0) {
        throw new Error(
            'READ_ROUTES is empty.'
        );
    }

    const route =
        READ_ROUTES[
            Math.floor(
                Math.random() * READ_ROUTES.length
            )
        ];

    const url = `${BASE_URL}${route}`;

    const response = http.get(url, {
        timeout: '10s',

        tags: {
            test: 'sparkle-phase2',
            type: 'read',
            route: route,
        },
    });

    // --------------------------------------------------------
    // REQUEST COUNT
    // --------------------------------------------------------

    sparkleRequests.add(1);

    sparkleLatency.add(
        response.timings.duration
    );

    // --------------------------------------------------------
    // RESPONSE CLASSIFICATION
    // --------------------------------------------------------

    if (
        response.status >= 200 &&
        response.status < 300
    ) {
        sparkle2xx.add(1);

    } else if (
        response.status >= 300 &&
        response.status < 400
    ) {
        sparkle3xx.add(1);

    } else if (
        response.status >= 400 &&
        response.status < 500
    ) {
        // Application-level response.
        //
        // 401 / 403 / 404 / 429 are NOT automatically
        // considered server capacity failures.

        sparkle4xx.add(1);

    } else if (
        response.status >= 500
    ) {
        // Genuine server-side failure.

        sparkle5xx.add(1);
        sparkleCapacityFailures.add(1);
    }

    // --------------------------------------------------------
    // NETWORK / TIMEOUT FAILURE
    // --------------------------------------------------------

    if (response.error) {
        sparkleTimeouts.add(1);
        sparkleCapacityFailures.add(1);
    }

    // --------------------------------------------------------
    // CHECKS
    // --------------------------------------------------------

    check(response, {
        'server responded': (r) =>
            r.status !== 0,

        'not a 5xx server error': (r) =>
            r.status < 500,

        'not a timeout': (r) =>
            !r.error,
    });
}

// ------------------------------------------------------------
// FINAL REPORT
// ------------------------------------------------------------

export function handleSummary(data) {

    const metrics = data.metrics;

    const totalRequests =
        metrics.sparkle_requests?.values?.count || 0;

    const responses2xx =
        metrics.sparkle_2xx?.values?.count || 0;

    const responses3xx =
        metrics.sparkle_3xx?.values?.count || 0;

    const responses4xx =
        metrics.sparkle_4xx?.values?.count || 0;

    const responses5xx =
        metrics.sparkle_5xx?.values?.count || 0;

    const timeouts =
        metrics.sparkle_timeouts?.values?.count || 0;

    const capacityFailures =
        metrics.sparkle_capacity_failures?.values?.count || 0;

    const latency =
        metrics.sparkle_latency?.values || {};

    const httpDuration =
        metrics.http_req_duration?.values || {};

    const actualVUs =
        metrics.vus_max?.values?.max || 0;

    const expectedRequests = 150 * 100;

    const requestCountPassed =
        totalRequests === expectedRequests;

    const report = `
============================================================
                 SPARKLE PHASE 2 REPORT
          150 VUs  100 REQUESTS = 15,000
                 LOCAL READ CAPACITY TEST
============================================================

Target:
${BASE_URL}

------------------------------------------------------------
TEST CONFIGURATION
------------------------------------------------------------

Virtual Users:              150
Iterations per VU:          100
Expected HTTP requests:     15,000

Actual maximum VUs:         ${actualVUs}
Actual HTTP requests:       ${totalRequests}

------------------------------------------------------------
REQUEST COUNT
------------------------------------------------------------

Expected:                   ${expectedRequests}
Actual:                     ${totalRequests}

Count integrity:
${requestCountPassed ? 'PASS' : 'FAIL'}

------------------------------------------------------------
RESPONSE BREAKDOWN
------------------------------------------------------------

2xx successful:             ${responses2xx}
3xx redirects:              ${responses3xx}
4xx application responses:  ${responses4xx}
5xx server errors:          ${responses5xx}
Timeouts/network errors:    ${timeouts}

------------------------------------------------------------
CAPACITY FAILURES
------------------------------------------------------------

5xx + network/timeout:      ${capacityFailures}

NOTE:
4xx responses are treated separately.

A 401, 403, 404 or 429 may be an expected
application response and is NOT automatically
considered infrastructure saturation.

------------------------------------------------------------
LATENCY
------------------------------------------------------------

Average:                    ${latency.avg ?? 'N/A'} ms
Median:                     ${latency.med ?? 'N/A'} ms
p90:                        ${latency['p(90)'] ?? 'N/A'} ms
p95:                        ${latency['p(95)'] ?? 'N/A'} ms
p99:                        ${latency['p(99)'] ?? 'N/A'} ms
Maximum:                    ${latency.max ?? 'N/A'} ms

HTTP p95:                   ${httpDuration['p(95)'] ?? 'N/A'} ms
HTTP p99:                   ${httpDuration['p(99)'] ?? 'N/A'} ms

------------------------------------------------------------
CAPACITY RESULT
------------------------------------------------------------

Expected:
150 users  100 requests

= 15,000 requests

Actual:
${totalRequests} requests

Maximum VUs observed:
${actualVUs}

Capacity failures:
${capacityFailures}

------------------------------------------------------------
FINAL RESULT
------------------------------------------------------------

${
    !requestCountPassed
        ? 'FAIL  REQUEST COUNT DID NOT REACH 15,000'
        : capacityFailures === 0
            ? 'PASS  NO 5XX/TIMEOUT CAPACITY FAILURES'
            : 'WARNING  CAPACITY FAILURES DETECTED'
}

============================================================
END OF SPARKLE PHASE 2
============================================================
`;

    return {
        'results/phase2-150vus-15k-summary.json':
            JSON.stringify(data, null, 2),

        'results/phase2-150vus-15k-report.txt':
            report,
    };
}
