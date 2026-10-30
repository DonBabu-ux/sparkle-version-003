
import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const errors = new Rate('http_errors');

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '30s', target: 10 },
    { duration: '30s', target: 20 },
    { duration: '20s', target: 30 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_errors: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const response = http.get(
    'https://sparkle-server-1-4nmx.onrender.com/',
    { timeout: '10s' }
  );

  const successful = check(response, {
    'status is not a server error': (r) => r.status < 500,
  });

  errors.add(!successful || response.status === 0);
}
