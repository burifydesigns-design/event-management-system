const request = require('supertest');
const mongoose = require('mongoose');
const { setupTestApp, teardownTestApp, clearDatabase } = require('./helpers');

let Event;
let User;

let app;
let mongoServer;
let organizerId;

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
};

async function seedEvents(count, overrides = {}) {
  const docs = [];
  for (let i = 0; i < count; i++) {
    docs.push({
      title: `Event ${String(i + 1).padStart(2, '0')}`,
      description: `Description for event ${i + 1}`,
      category: i % 2 === 0 ? 'Music' : 'Sports',
      date: daysFromNow(i + 1),
      time: '10:00 AM',
      location: 'Hall A',
      city: i % 3 === 0 ? 'Nairobi' : 'Mombasa',
      capacity: 100,
      price: i % 2 === 0 ? 0 : 20,
      organizer: organizerId,
      status: 'published',
      ...overrides,
    });
  }
  return Event.create(docs);
}

beforeAll(async () => {
  ({ app, mongoServer } = await setupTestApp());
  Event = mongoose.model('Event');
  User = mongoose.model('User');
});

afterAll(async () => {
  await teardownTestApp(mongoServer);
});

beforeEach(async () => {
  await clearDatabase();
  const organizer = await User.create({
    name: 'Organizer',
    email: `organizer-${Date.now()}@test.com`,
    password: 'secret123',
    role: 'organizer',
  });
  organizerId = organizer._id;
});

describe('GET /api/events - pagination contract', () => {
  test('defaults: page 1, limit 12, includes pagination metadata and legacy fields', async () => {
    await seedEvents(30);

    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(12);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(12);
    expect(res.body.totalEvents).toBe(30);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 12,
      totalItems: 30,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  test('valid page and limit return the correct slice', async () => {
    await seedEvents(30);

    const res = await request(app).get('/api/events?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(10);
    expect(res.body.events[0].title).toBe('Event 11');
    expect(res.body.pagination.hasPreviousPage).toBe(true);
    expect(res.body.pagination.hasNextPage).toBe(true);
  });

  test('last page returns a partial slice', async () => {
    await seedEvents(25);

    const res = await request(app).get('/api/events?page=3&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(5);
    expect(res.body.pagination.hasNextPage).toBe(false);
  });

  test('rejects non-numeric page with 400', async () => {
    const res = await request(app).get('/api/events?page=abc');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/page/);
  });

  test('rejects negative page with 400', async () => {
    const res = await request(app).get('/api/events?page=-2');
    expect(res.status).toBe(400);
  });

  test('rejects non-numeric limit with 400', async () => {
    const res = await request(app).get('/api/events?limit=ten');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/limit/);
  });

  test('enforces maximum page size by clamping', async () => {
    await seedEvents(30);
    const res = await request(app).get('/api/events?limit=10000');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });

  test('empty collection returns empty page with zeroed metadata', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 12,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  test('page beyond the last page returns empty data with correct metadata', async () => {
    await seedEvents(5);
    const res = await request(app).get('/api/events?page=50&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(5);
    expect(res.body.pagination.hasNextPage).toBe(false);
    expect(res.body.pagination.hasPreviousPage).toBe(true);
  });

  test('only published events are visible publicly', async () => {
    await seedEvents(5, { status: 'draft' });
    const res = await request(app).get('/api/events');
    expect(res.body.events).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(0);
  });
});

describe('GET /api/events - search, filters, sorting with pagination', () => {
  test('search applies before pagination and totals reflect matches only', async () => {
    await seedEvents(20);
    await Event.updateMany(
      { title: { $in: ['Event 01', 'Event 02', 'Event 03', 'Event 04', 'Event 05', 'Event 06', 'Event 07'] } },
      { $set: { title: 'Jazz Night Special' } }
    );

    const res = await request(app).get('/api/events?search=Jazz&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(5);
    expect(res.body.pagination.totalItems).toBe(7);
    expect(res.body.pagination.totalPages).toBe(2);

    const page2 = await request(app).get('/api/events?search=Jazz&limit=5&page=2');
    expect(page2.body.events).toHaveLength(2);
    const ids = new Set([...res.body.events, ...page2.body.events].map((e) => e._id));
    expect(ids.size).toBe(7);
  });

  test('category filter is applied before pagination', async () => {
    await seedEvents(20); // 10 Music, 10 Sports
    const res = await request(app).get('/api/events?category=Music&limit=4');
    expect(res.body.events).toHaveLength(4);
    expect(res.body.events.every((e) => e.category === 'Music')).toBe(true);
    expect(res.body.pagination.totalItems).toBe(10);
  });

  test('deterministic sort with equal dates never duplicates or drops records across pages', async () => {
    const sameDate = daysFromNow(3);
    await seedEvents(21, { date: sameDate });

    const seen = new Set();
    for (let page = 1; page <= 3; page++) {
      const res = await request(app).get(`/api/events?page=${page}&limit=7`);
      expect(res.status).toBe(200);
      res.body.events.forEach((e) => {
        expect(seen.has(e._id)).toBe(false);
        seen.add(e._id);
      });
    }
    expect(seen.size).toBe(21);
  });

  test('pages are consistent when queried repeatedly', async () => {
    await seedEvents(30);
    const first = await request(app).get('/api/events?page=1&limit=5');
    const last = await request(app).get('/api/events?page=6&limit=5');
    const firstAgain = await request(app).get('/api/events?page=1&limit=5');
    expect(firstAgain.body.events.map((e) => e._id)).toEqual(first.body.events.map((e) => e._id));
    expect(last.body.events).toHaveLength(5);
  });
});

