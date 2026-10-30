
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = 'https://sparkle-server-1-4nmx.onrender.com';
const TARGET_RPS = Number(__ENV.RPS || 50);
const TEST_DURATION = __ENV.DURATION || '60s';

const failures = new Rate('request_failures');
const latency = new Trend('api_latency');

export const options = {
  scenarios: {
    controlled_load: {
      executor: 'constant-arrival-rate',
      rate: TARGET_RPS,
      timeUnit: '1s',
      duration: TEST_DURATION,
      preAllocatedVUs: 100,
      maxVUs: 300,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const response = http.get(`${BASE_URL}/api/ping`, {
    timeout: '10s',
    tags: { endpoint: 'api-ping' },
  });

  latency.add(response.timings.duration);
  failures.add(response.status < 200 || response.status >= 400);

  check(response, {
    'status is 2xx or 3xx': (r) =>
      r.status >= 200 && r.status < 400,
  });
}
