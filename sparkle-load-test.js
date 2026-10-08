import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const errors = new Rate("sparkle_errors");
const latency = new Trend("sparkle_api_latency", true);
const requests = new Counter("sparkle_requests");

const ENDPOINTS = [
    {
        name: "health",
        method: "GET",
        path: "/health",
        weight: 2
    },
    {
        name: "feed",
        method: "GET",
        path: "/api/feed",
        weight: 5
    },
    {
        name: "notifications",
        method: "GET",
        path: "/api/notifications",
        weight: 2
    },
    {
        name: "security-status",
        method: "GET",
        path: "/api/security/status",
        weight: 1
    },
    {
        name: "sessions",
        method: "GET",
        path: "/api/users/sessions",
        weight: 1
    },
    {
        name: "profile",
        method: "GET",
        path: "/api/users/me",
        weight: 2
    }
];


/*
 * Select an endpoint according to its weight.
 */
function weightedEndpoint() {

    const total = ENDPOINTS.reduce(
        (sum, endpoint) => sum + endpoint.weight,
        0
    );

    let number = Math.random() * total;

    for (const endpoint of ENDPOINTS) {

        number -= endpoint.weight;

        if (number <= 0) {
            return endpoint;
        }
    }

    return ENDPOINTS[0];
}


/*
 * TEST CONFIGURATION
 *
 * This ramps instead of creating an instant uncontrolled flood.
 */
export const options = {

    scenarios: {

        capacity_test: {

            executor: "ramping-vus",

            startVUs: 1,

            stages: [

                // Warm-up
                {
                    duration: "30s",
                    target: 10
                },

                // Small load
                {
                    duration: "30s",
                    target: 25
                },

                // Medium load
                {
                    duration: "45s",
                    target: 50
                },

                // Heavy load
                {
                    duration: "60s",
                    target: 100
                },

                // Very heavy load
                {
                    duration: "60s",
                    target: 200
                },

                // Capacity test
                {
                    duration: "60s",
                    target: 300
                },

                // Stop
                {
                    duration: "30s",
                    target: 0
                }
            ],

            gracefulRampDown: "15s"
        }
    },


    thresholds: {

        http_req_failed: [
            "rate<0.10"
        ],

        http_req_duration: [
            "p(95)<1500",
            "p(99)<3000"
        ],

        sparkle_errors: [
            "rate<0.10"
        ]
    }
};


/*
 * Setup runs once before the virtual users start.
 */
export function setup() {

    console.log("");
    console.log("======================================");
    console.log("       SPARKLE CAPACITY TEST");
    console.log("======================================");
    console.log("");

    console.log(
        `Target: ${BASE_URL}`
    );

    console.log(
        "Maximum virtual users: 300"
    );

    console.log("");

    return {};
}


/*
 * Every virtual user repeatedly executes this function.
 */
export default function () {

    const endpoint = weightedEndpoint();

    const url =
        `${BASE_URL}${endpoint.path}`;


    const started =
        Date.now();


    const response = http.request(

        endpoint.method,

        url,

        null,

        {

            headers: {

                Accept:
                    "application/json"
            },

            tags: {

                endpoint:
                    endpoint.name
            },

            timeout:
                "10s"
        }
    );


    const duration =
        Date.now() - started;


    requests.add(1);

    latency.add(duration);


    const successful =
        check(

            response,

            {

                "response received":
                    (r) =>
                        r.status > 0,

                "not a server error":
                    (r) =>
                        r.status < 500
            }
        );


    errors.add(
        !successful
    );


    /*
     * Simulates a little user think-time.
     *
     * This prevents the test from becoming
     * an unrealistic tight request loop.
     */
    sleep(
        Math.random() * 1.5 + 0.2
    );
}