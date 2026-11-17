import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    ticket_rush: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 100),
      iterations: Number(__ENV.ITERATIONS || 100),
      maxDuration: '3m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

const baseUrl = (__ENV.API_URL || '').replace(/\/$/, '');
const eventId = __ENV.EVENT_ID;
const ticketTypeId = __ENV.TICKET_TYPE_ID;
const tokens = (__ENV.ATTENDEE_TOKENS || '').split(',').map((v) => v.trim()).filter(Boolean);

export default function () {
  if (!baseUrl || !eventId || !ticketTypeId || tokens.length === 0) {
    throw new Error('Set API_URL, EVENT_ID, TICKET_TYPE_ID and ATTENDEE_TOKENS before running this test.');
  }

  const token = tokens[(__VU - 1) % tokens.length];
  const response = http.post(
    `${baseUrl}/orders`,
    JSON.stringify({ eventId, ticketTypeId, quantity: 1 }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': `load-${Date.now()}-${__VU}-${__ITER}-${Math.random().toString(36).slice(2)}`,
      },
      timeout: '15s',
    },
  );

  check(response, {
    'checkout accepted or inventory correctly rejected': (r) => r.status === 202 || r.status === 200 || r.status === 409,
    'no server errors': (r) => r.status < 500,
  });
  sleep(0.1);
}

export function handleSummary(data) {
  const accepted = data.metrics.checks?.passes || 0;
  return {
    stdout: JSON.stringify({
      iterations: data.metrics.iterations?.values?.count || 0,
      acceptedOrRejectedChecksPassed: accepted,
      p95Ms: data.metrics.http_req_duration?.values?.['p(95)'],
      failedRequestRate: data.metrics.http_req_failed?.values?.rate,
    }, null, 2) + '\n',
  };
}
