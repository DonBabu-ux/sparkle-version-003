import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'https://sparkle-server-1-4nmx.onrender.com';

export const options = {
  stages: [
    { duration: '10s', target: 1 },
    { duration: '10s', target: 5 },
    { duration: '15s', target: 10 },
    { duration: '15s', target: 20 },
    { duration: '10s', target: 30 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const res = http.get(BASE_URL, {
    timeout: '10s',
    tags: { endpoint: 'root' },
  });

  const ok = check(res, {
    'server returns HTTP 2xx or 3xx': (r) =>
      r.status >= 200 && r.status < 400,
  });

  if (!ok) {
    console.warn(
      `HTTP ${res.status} | ${res.url} | ${String(res.body || '').slice(0, 150)}`
    );
  }

  sleep(1);
}
