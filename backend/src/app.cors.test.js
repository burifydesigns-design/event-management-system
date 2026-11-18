const request = require('supertest');

// The app kicks off a Supabase connectivity check on load; keep the test hermetic.
jest.mock('./config/db', () => jest.fn(() => Promise.resolve()));

const ALLOWED = 'https://event-management-system-burify.vercel.app';
const ALSO_ALLOWED = 'http://localhost:5173';

let app;

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL = `${ALLOWED}, ${ALSO_ALLOWED}`;
  process.env.SUPABASE_URL = 'http://127.0.0.1:9';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // eslint-disable-next-line global-require
  app = require('./app');
});

afterAll(() => {
  jest.restoreAllMocks();
});

function preflight(origin) {
  return request(app)
    .options('/api/auth/login')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,authorization');
}

describe('CORS origin allowlist', () => {
  test.each([ALLOWED, ALSO_ALLOWED])('allows configured origin %s with credentials', async (origin) => {
    const res = await preflight(origin);
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  test.each([
    'https://evil.example',
    // Looks like this project's Vercel URLs, but anyone can register a project with such a name.
    'https://event-management-system-evil-burify.vercel.app',
    'https://event-management-system.vercel.app',
    `${ALLOWED}.evil.example`,
    'http://event-management-system-burify.vercel.app',
    'null',
  ])('rejects %s with 403 and no CORS headers', async (origin) => {
    const res = await preflight(origin);
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.body.message).toBe('Origin is not allowed');
  });

  test('requests without an Origin header (server-to-server, Safaricom callback) are not blocked by CORS', async () => {
    // Reaches the route's own token check (401) instead of being stopped by CORS (403); touches no database.
    const res = await request(app).post('/api/internal/outbox/process');
    expect(res.status).toBe(401);
  });
});
