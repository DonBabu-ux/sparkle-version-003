
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

const BASE_URL = (__ENV.BASE_URL || 'https://sparkle-server-1-4nmx.onrender.com')
  .replace(/\/+$/, '');

const TARGET_VUS = Number(__ENV.TARGET_VUS || 200);
const TEST_DURATION = __ENV.TEST_DURATION || '1m';
const TOKEN = __ENV.TOKEN || '';

const tokenLines = __ENV.TOKENS_FILE
  ? new SharedArray('test tokens', () =>
      open(__ENV.TOKENS_FILE)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  : [];

const features = {
  feed: ['/api/posts/feed'],
  stories: ['/api/stories/active'],
  moments: ['/api/moments/stream'],
  profiles: ['/api/users/me', '/api/users/suggestions'],
  discovery: ['/api/discover/feed', '/api/discover/suggested-users'],
  messages: ['/api/messages/inbox'],
  groupChats: ['/api/groupChat'],
  groups: ['/api/groups'],
  marketplace: ['/api/marketplace/marketplace/listings'],
  confessions: ['/api/confessions'],
  notifications: ['/api/notifications', '/api/notifications/unread-count'],
  campusEvents: ['/api/events', '/api/polls', '/api/streams/active'],
};

const featureNames = Object.keys(features);

const scenarios = {};

for (const feature of featureNames) {
  scenarios[feature] = {
    executor: 'ramping-vus',
    exec: 'featureLoad',
    startVUs: 0,
    stages: [
      { duration: '1m', target: Math.min(25, TARGET_VUS) },
      { duration: '1m', target: Math.min(50, TARGET_VUS) },
      { duration: '1m', target: Math.min(100, TARGET_VUS) },
      { duration: '1m', target: TARGET_VUS },
      { duration: TEST_DURATION, target: TARGET_VUS },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '30s',
    tags: { feature },
  };
}

export const options = {
  scenarios,
  discardResponseBodies: true,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

function getTokenForScenario() {
  if (tokenLines.length > 0) {
    const featureIndex = featureNames.indexOf(exec.scenario.name);
    const index = featureIndex * TARGET_VUS + ((__VU - 1) % TARGET_VUS);
    return tokenLines[index % tokenLines.length];
  }

  return TOKEN;
}

export function featureLoad() {
  const feature = exec.scenario.name;
  const paths = features[feature];

  if (!paths) {
    throw new Error(`Unknown feature scenario: ${feature}`);
  }

  const token = getTokenForScenario();
  const headers = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const path = paths[Math.floor(Math.random() * paths.length)];
  const response = http.get(`${BASE_URL}${path}`, {
    headers,
    tags: {
      feature,
      endpoint: path,
    },
    timeout: '30s',
  });

  check(response, {
    [`${feature}: HTTP response received`]: (r) => r.status > 0,
    [`${feature}: not server error`]: (r) => r.status < 500,
  });

  // Approximate user think time between page/API requests.
  sleep(1 + Math.random() * 2);
}
