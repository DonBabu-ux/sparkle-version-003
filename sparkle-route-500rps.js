
import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

const BASE_URL = (
  __ENV.BASE_URL || 'https://sparkle-server-1-4nmx.onrender.com'
).replace(/\/+$/, '');

const RPS = Number(__ENV.RPS || 500);
const DURATION = __ENV.DURATION || '10s';
const TOKEN = __ENV.TOKEN || '';

const routes = {
  health: '/health',
  ping: '/api/ping',
  feed: '/api/posts/feed',
  stories: '/api/stories/active',
  moments: '/api/moments/stream',
  profile: '/api/users/me',
  discovery: '/api/discover/feed',
  inbox: '/api/messages/inbox',
  groupChats: '/api/groupChat',
  groups: '/api/groups',
  marketplace: '/api/marketplace/listings',
  confessions: '/api/confessions',
};

const scenarios = {};

for (const name of Object.keys(routes)) {
  scenarios[name] = {
    executor: 'constant-arrival-rate',
    exec: 'testRoute',
    rate: RPS,
    timeUnit: '1s',
    duration: DURATION,
    preAllocatedVUs: 500,
    maxVUs: 1500,
    gracefulStop: '5s',
    tags: { route: name },
  };
}

export const options = {
  scenarios,
  discardResponseBodies: true,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function testRoute() {
  const name = exec.scenario.name;
  const path = routes[name];

  const headers = { Accept: 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const response = http.get(`${BASE_URL}${path}`, {
    headers,
    timeout: '15s',
    tags: { route: name },
  });

  check(response, {
    [`${name}: server responded`]: (r) => r.status > 0,
    [`${name}: not a server error`]: (r) => r.status < 500,
  });
}
