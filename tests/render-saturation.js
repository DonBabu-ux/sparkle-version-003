import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.SPARKLE_API_URL;

const errors = new Counter('sparkle_errors');
const serverErrors = new Counter('sparkle_5xx');
const throttled = new Counter('sparkle_429');
const latency = new Trend('sparkle_latency');

const routes = [
    '/api/health',
    '/api/health',
    '/api/health',
    '/'
];

export const options = {
    scenarios: {
        saturation: {
            executor: 'constant-arrival-rate',

            // Start deliberately low.
            rate: Number(__ENV.RATE || 100),

            timeUnit: '1s',
            duration: __ENV.DURATION || '30s',

            preAllocatedVUs: 100,
            maxVUs: 1000,
        },
    },

    thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<3000'],
    },
};

export default function () {
    const route = routes[Math.floor(Math.random() * routes.length)];

    const res = http.get(`${BASE_URL}${route}`, {
        tags: { endpoint: route },
        timeout: '10s',
    });

    latency.add(res.timings.duration);

    if (res.status >= 500) {
        serverErrors.add(1);
        errors.add(1);
    } else if (res.status === 429) {
        throttled.add(1);
    } else if (res.status >= 400) {
        errors.add(1);
    }

    check(res, {
        'request completed': r => r.status > 0,
    });
}
