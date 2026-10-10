import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ALLOW_TARGET = (__ENV.ALLOW_TARGET || "false").toLowerCase() === "true";

if (!ALLOW_TARGET && !/^https?:\/\/localhost(?::\d+)?$/i.test(BASE_URL)) {
    throw new Error(
        `SAFETY STOP: BASE_URL=${BASE_URL}\n` +
        `Phase 1 requires localhost unless you explicitly set ALLOW_TARGET=true.`
    );
}

const inventory = open("./sparkle-api-inventory.txt");

const safeSection = inventory.match(
    /SAFE READ ENDPOINTS\s*-+\s*([\s\S]*?)\s*-+\s*AUTHENTICATED READ ENDPOINTS/
);

if (!safeSection) {
    throw new Error("Could not find SAFE READ ENDPOINTS in sparkle-api-inventory.txt");
}

const allSafeReads = [];

for (const line of safeSection[1].split("\n")) {
    const match = line.match(/^\s*GET\s+(\S+)/);

    if (match) {
        allSafeReads.push(match[1].trim());
    }
}

/*
 * These routes are read-only but may invoke external services.
 * We keep them out of the first database/API capacity baseline.
 */
const EXCLUDED_EXTERNAL_READS = new Set([
    "/api/audio/search",
    "/api/giphy/search",
    "/api/giphy/trending",
    "/api/link-preview",
    "/api/music/search"
]);

/*
 * Routes containing :id, :chatId, :userId, etc. need real
 * application data. Sending literal ":id" values would mostly
 * produce artificial 404/validation traffic.
 */
const parameterized = allSafeReads.filter(path => path.includes(":"));

const endpoints = allSafeReads.filter(path =>
    !path.includes(":") &&
    !EXCLUDED_EXTERNAL_READS.has(path)
);

const requests = new Counter("sparkle_phase1_requests");
const failures = new Rate("sparkle_phase1_failures");
const latency = new Trend("sparkle_phase1_latency", true);
const serverErrors = new Counter("sparkle_phase1_5xx");
const clientErrors = new Counter("sparkle_phase1_4xx");
const timeouts = new Counter("sparkle_phase1_timeouts");

export const options = {
    scenarios: {
        phase1_capacity: {
            executor: "ramping-vus",
            startVUs: 1,

            stages: [
                { duration: "30s", target: 10 },
                { duration: "30s", target: 25 },
                { duration: "45s", target: 50 },
                { duration: "60s", target: 100 },
                { duration: "60s", target: 200 },
                { duration: "60s", target: 300 },

                // Cool down instead of ending abruptly.
                { duration: "30s", target: 0 }
            ],

            gracefulRampDown: "15s"
        }
    },

    thresholds: {
        http_req_failed: ["rate<0.10"],
        http_req_duration: [
            "p(95)<1500",
            "p(99)<3000"
        ],

        sparkle_phase1_failures: ["rate<0.10"]
    }
};

function pickEndpoint() {
    return endpoints[Math.floor(Math.random() * endpoints.length)];
}

export function setup() {
    console.log("");
    console.log("=================================================");
    console.log("              SPARKLE PHASE 1A");
    console.log("          SAFE READ CAPACITY TEST");
    console.log("=================================================");
    console.log(`Target:              ${BASE_URL}`);
    console.log(`Safe GETs discovered: ${allSafeReads.length}`);
    console.log(`Static GETs tested:   ${endpoints.length}`);
    console.log(`Parameterized skip:   ${parameterized.length}`);
    console.log(`External read skip:   ${EXCLUDED_EXTERNAL_READS.size}`);
    console.log("Maximum VUs:          300");
    console.log("");
    console.log("Traffic is READ ONLY.");
    console.log("No POST/PUT/PATCH/DELETE requests are generated.");
    console.log("");

    console.log("Endpoints being tested:");

    for (const endpoint of endpoints) {
        console.log(`  GET ${endpoint}`);
    }

    console.log("");

    if (parameterized.length > 0) {
        console.log("Parameterized SAFE_READ routes deferred:");
        for (const endpoint of parameterized) {
            console.log(`  ${endpoint}`);
        }
        console.log("");
    }

    return {
        startedAt: new Date().toISOString(),
        endpointCount: endpoints.length
    };
}

export default function () {
    const endpoint = pickEndpoint();
    const url = `${BASE_URL}${endpoint}`;

    const started = Date.now();

    const response = http.get(url, {
        timeout: "10s",
        headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache"
        },

        tags: {
            phase: "1A",
            endpoint
        }
    });

    const duration = Date.now() - started;

    requests.add(1);
    latency.add(duration);

    const status = response.status;

    if (status >= 500) {
        serverErrors.add(1);
    }

    if (status >= 400 && status < 500) {
        clientErrors.add(1);
    }

    if (status === 0) {
        timeouts.add(1);
    }

    /*
     * For capacity testing:
     *
     * 2xx/3xx = successful
     * 4xx      = endpoint/application response
     * 5xx      = server failure
     * 0        = network/timeout failure
     */
    const healthy = check(response, {
        "server responded": r => r.status > 0,
        "not a server error": r => r.status < 500,
        "not a timeout": r => r.status !== 0
    });

    failures.add(!healthy);

    /*
     * Small user think-time.
     * This prevents the test from becoming an artificial
     * zero-delay request flood.
     */
    sleep(Math.random() * 1.5 + 0.3);
}

function metric(data, name, field) {
    return data.metrics?.[name]?.values?.[field] ?? 0;
}

export function handleSummary(data) {
    const duration = metric(data, "http_req_duration", "avg");
    const p50 = metric(data, "http_req_duration", "med");
    const p95 = metric(data, "http_req_duration", "p(95)");
    const p99 = metric(data, "http_req_duration", "p(99)");

    const totalRequests =
        metric(data, "http_reqs", "count");

    const failed =
        metric(data, "http_req_failed", "rate") * 100;

    const report = `
========================================================
                 SPARKLE PHASE 1A REPORT
                 SAFE READ CAPACITY TEST
========================================================

Generated: ${new Date().toISOString()}
Target: ${BASE_URL}

--------------------------------------------------------
TEST CONFIGURATION
--------------------------------------------------------

Maximum VUs:                 300
Safe GET routes discovered:  ${allSafeReads.length}
Static GET routes tested:    ${endpoints.length}
Parameterized routes skipped:${parameterized.length}
External reads skipped:     ${EXCLUDED_EXTERNAL_READS.size}

Traffic:
  GET only
  No writes
  No uploads
  No OTP
  No SMS
  No payments
  No account deletion

--------------------------------------------------------
HTTP PERFORMANCE
--------------------------------------------------------

Total requests:              ${totalRequests}
Average latency:             ${duration.toFixed(2)} ms
Median / p50:                ${p50.toFixed(2)} ms
p95 latency:                 ${p95.toFixed(2)} ms
p99 latency:                 ${p99.toFixed(2)} ms
HTTP failure rate:           ${failed.toFixed(2)} %

--------------------------------------------------------
INTERPRETATION
--------------------------------------------------------

p95 < 1.5s:
  Healthy target for this phase.

p95 1.5s - 3s:
  Performance pressure is appearing.

p95 > 3s:
  Investigate before increasing load.

5xx or timeout growth:
  Indicates server/infrastructure saturation
  rather than normal application-level 4xx responses.

--------------------------------------------------------
PARAMETERIZED ROUTES DEFERRED
--------------------------------------------------------

${parameterized.map(x => `GET ${x}`).join("\n")}

--------------------------------------------------------
EXTERNAL READS DEFERRED
--------------------------------------------------------

${[...EXCLUDED_EXTERNAL_READS].map(x => `GET ${x}`).join("\n")}

========================================================
END OF PHASE 1A
========================================================
`;

    return {
        "results/phase1a-report.txt": report,
        "results/phase1a-summary.json": JSON.stringify(data, null, 2)
    };
}