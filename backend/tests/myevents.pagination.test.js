const request = require('supertest');
const mongoose = require('mongoose');
const { setupTestApp, teardownTestApp, clearDatabase, authToken } = require('./helpers');

let Event;
let User;
let Registration;

let app;
let mongoServer;
let userToken;
let otherUserToken;
let userId;
let otherUserId;

const daysFromOffset = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
};

async function makeEvent(i, offset) {
  return Event.create({
    title: `My Event ${i}`,
    description: 'd',
    category: 'Music',
    date: daysFromOffset(offset),
    time: '10:00 AM',
    location: 'Hall',
    city: 'Nairobi',
    capacity: 100,
    price: 0,
    organizer: userId,
    status: 'published',
  });
}

async function registerFor(event, user, status = 'confirmed', offsetMs = 0) {
  return Registration.create({
    user,
    event: event._id,
    ticketNumber: `T-${Math.random().toString(36).slice(2, 10)}`,
    status,
    registeredAt: new Date(Date.now() - offsetMs),
  });
}

beforeAll(async () => {
  ({ app, mongoServer } = await setupTestApp());
  Event = mongoose.model('Event');
  User = mongoose.model('User');
  Registration = mongoose.model('Registration');
});

afterAll(async () => {
  await teardownTestApp(mongoServer);
});

beforeEach(async () => {
  await clearDatabase();
  const user = await User.create({
    name: 'User', email: `user-${Date.now()}@test.com`, password: 'secret123', role: 'attendee',
  });
  userId = user._id;
  userToken = authToken({ userId: user._id, role: 'attendee' });

  const other = await User.create({
    name: 'Other', email: `other-${Date.now()}@test.com`, password: 'secret123', role: 'attendee',
  });
  otherUserId = other._id;
  otherUserToken = authToken({ userId: other._id, role: 'attendee' });
});

describe('GET /api/registrations/my-events - pagination and tabs', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/registrations/my-events');
    expect(res.status).toBe(401);
  });

  test('defaults to page 1 with limit 10 and returns counts', async () => {
    for (let i = 0; i < 12; i++) {
      const e = await makeEvent(i, i + 1);
      await registerFor(e, userId);
    }

    const res = await request(app)
      .get('/api/registrations/my-events')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination).toEqual({
      page: 1, limit: 10, totalItems: 12, totalPages: 2, hasNextPage: true, hasPreviousPage: false,
    });
    expect(res.body.counts).toEqual({ upcoming: 12, past: 0, cancelled: 0 });
    expect(res.body.data[0].event).toHaveProperty('title');
  });

  test('page 2 returns the remaining records without overlap', async () => {
    for (let i = 0; i < 12; i++) {
      const e = await makeEvent(i, i + 1);
      await registerFor(e, userId);
    }

    const p1 = await request(app)
      .get('/api/registrations/my-events?limit=10')
      .set('Authorization', `Bearer ${userToken}`);
    const p2 = await request(app)
      .get('/api/registrations/my-events?limit=10&page=2')
      .set('Authorization', `Bearer ${userToken}`);
    expect(p2.body.data).toHaveLength(2);
    expect(p2.body.pagination.hasPreviousPage).toBe(true);

    const ids = new Set([...p1.body.data, ...p2.body.data].map((r) => r._id));
    expect(ids.size).toBe(12);
  });

  test('upcoming tab filters by future event date', async () => {
    const future = await makeEvent(1, 5);
    const past = await makeEvent(2, -5);
    await registerFor(future, userId);
    await registerFor(past, userId);

    const res = await request(app)
      .get('/api/registrations/my-events?tab=upcoming')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.body.pagination.totalItems).toBe(1);
    expect(res.body.data[0].event.title).toBe('My Event 1');
    expect(res.body.counts).toEqual({ upcoming: 1, past: 1, cancelled: 0 });
  });

  test('past tab includes confirmed registrations with past event dates', async () => {
    await registerFor(await makeEvent(1, -3), userId);
    await registerFor(await makeEvent(2, -9), userId);

    const res = await request(app)
      .get('/api/registrations/my-events?tab=past')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.body.pagination.totalItems).toBe(2);
  });

  test('cancelled tab returns cancelled registrations only', async () => {
    await registerFor(await makeEvent(1, 3), userId, 'cancelled');
    await registerFor(await makeEvent(2, 4), userId, 'confirmed');

    const res = await request(app)
      .get('/api/registrations/my-events?tab=cancelled')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.body.pagination.totalItems).toBe(1);
    expect(res.body.data[0].status).toBe('cancelled');
  });

  test('invalid tab returns 400', async () => {
    const res = await request(app)
      .get('/api/registrations/my-events?tab=weird')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(400);
  });

  test('invalid pagination params return 400', async () => {
    const res = await request(app)
      .get('/api/registrations/my-events?page=x')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/registrations/my-events - isolation and stability', () => {
  test('user isolation: only the authenticated user\'s registrations are returned', async () => {
    for (let i = 0; i < 3; i++) {
      await registerFor(await makeEvent(i, i + 1), userId);
    }
    for (let i = 0; i < 5; i++) {
      const e = await makeEvent(100 + i, i + 1);
      await registerFor(e, otherUserId);
    }

    const res = await request(app)
      .get('/api/registrations/my-events?limit=50')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.body.pagination.totalItems).toBe(3);
    res.body.data.forEach((r) => expect(String(r.user)).toBe(String(userId)));
  });

  test('stable pagination when registrations share the same timestamp', async () => {
    const sameTime = new Date();
    for (let i = 0; i < 11; i++) {
      const e = await makeEvent(i, i + 1);
      const reg = await registerFor(e, userId);
      await Registration.updateOne({ _id: reg._id }, { $set: { registeredAt: sameTime } });
    }

    const seen = new Set();
    for (let page = 1; page <= 2; page++) {
      const res = await request(app)
        .get(`/api/registrations/my-events?limit=5&page=${page}`)
        .set('Authorization', `Bearer ${userToken}`);
      res.body.data.forEach((r) => {
        expect(seen.has(r._id)).toBe(false);
        seen.add(r._id);
      });
    }
    expect(seen.size).toBe(11);
  });

  test('page beyond the last page returns empty data with correct metadata', async () => {
    await registerFor(await makeEvent(1, 3), userId);
    const res = await request(app)
      .get('/api/registrations/my-events?page=10&limit=10')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.totalItems).toBe(1);
    expect(res.body.pagination.hasNextPage).toBe(false);
  });
});

describe('Registration flow regression (Step 24 baseline)', () => {
  test('register, list in my-events, then cancel moves to cancelled tab', async () => {
    const event = await makeEvent(1, 3);

    const create = await request(app)
      .post('/api/registrations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ eventId: event._id });
    expect(create.status).toBe(201);
    const regId = create.body._id;

    const listed = await request(app)
      .get('/api/registrations/my-events?tab=upcoming')
      .set('Authorization', `Bearer ${userToken}`);
    expect(listed.body.pagination.totalItems).toBe(1);

    const cancel = await request(app)
      .delete(`/api/registrations/${regId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(cancel.status).toBe(200);

    const cancelled = await request(app)
      .get('/api/registrations/my-events?tab=cancelled')
      .set('Authorization', `Bearer ${userToken}`);
    expect(cancelled.body.pagination.totalItems).toBe(1);
  });

  test('duplicate registration is rejected', async () => {
    const event = await makeEvent(1, 3);
    await request(app)
      .post('/api/registrations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ eventId: event._id });

    const dup = await request(app)
      .post('/api/registrations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ eventId: event._id });
    expect(dup.status).toBe(409);
  });

  test('another user cannot cancel a registration', async () => {
    const event = await makeEvent(1, 3);
    const reg = await registerFor(event, userId);

    const res = await request(app)
      .delete(`/api/registrations/${reg._id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);
    expect(res.status).toBe(403);
  });
});

