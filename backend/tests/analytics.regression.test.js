const request = require('supertest');
const mongoose = require('mongoose');
const { setupTestApp, teardownTestApp, clearDatabase, authToken } = require('./helpers');

let Event;
let User;
let Registration;

let app;
let mongoServer;
let adminToken;
let attendeeToken;
let adminId;

const daysFromOffset = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
};

async function makeEvent(i, offset, capacity = 100) {
  return Event.create({
    title: `Analytics Event ${i}`,
    description: 'd',
    category: 'Music',
    date: daysFromOffset(offset),
    time: '10:00 AM',
    location: 'Hall',
    city: 'Nairobi',
    capacity,
    price: 0,
    organizer: adminId,
    status: 'published',
  });
}

async function registerFor(event, user, status = 'confirmed', checkedIn = false) {
  return Registration.create({
    user,
    event: event._id,
    ticketNumber: `AN-${Math.random().toString(36).slice(2, 10)}`,
    status,
    checkedIn,
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
  const admin = await User.create({
    name: 'Admin', email: `admin-${Date.now()}@test.com`, password: 'secret123', role: 'admin',
  });
  adminId = admin._id;
  adminToken = authToken({ userId: admin._id, role: 'admin' });

  const attendee = await User.create({
    name: 'Attendee', email: `att-${Date.now()}@test.com`, password: 'secret123', role: 'attendee',
  });
  attendeeToken = authToken({ userId: attendee._id, role: 'attendee' });
});

describe('Step 22 regression: analytics aggregates are unaffected by list pagination', () => {
  test('requires admin role', async () => {
    const res = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${attendeeToken}`);
    expect(res.status).toBe(403);
  });

  test('totals cover ALL registrations, not just a displayed page', async () => {
    const e1 = await makeEvent(1, 5, 20);
    const e2 = await makeEvent(2, 6, 20);
    const e3 = await makeEvent(3, 7, 20);

    const users = [];
    for (let i = 0; i < 30; i++) {
      const u = await User.create({
        name: `U${i}`, email: `u${i}-${Date.now()}@test.com`, password: 'secret123', role: 'attendee',
      });
      users.push(u);
    }

    for (let i = 0; i < 12; i++) await registerFor(e1, users[i]._id, 'confirmed', i < 6);
    for (let i = 12; i < 22; i++) await registerFor(e2, users[i]._id, 'confirmed', false);
    for (let i = 22; i < 25; i++) await registerFor(e3, users[i]._id, 'confirmed', true);
    for (let i = 25; i < 30; i++) await registerFor(e3, users[i]._id, 'cancelled', false);

    // Touch the paginated list endpoints (as the UI would) before checking analytics.
    await request(app).get('/api/events?limit=2');
    await request(app)
      .get(`/api/admin/events/${e1._id}/attendees?limit=2`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const { registrationsOverTime, registrationsPerEvent, checkInRate, capacityUtilization } = res.body;

    const perEventTotal = registrationsPerEvent.reduce((sum, r) => sum + r.count, 0);
    expect(perEventTotal).toBe(25); // confirmed only
    const countsByEvent = Object.fromEntries(registrationsPerEvent.map((r) => [String(r._id), r.count]));
    expect(countsByEvent[String(e1._id)]).toBe(12);
    expect(countsByEvent[String(e2._id)]).toBe(10);
    expect(countsByEvent[String(e3._id)]).toBe(3);

    const overTimeTotal = registrationsOverTime.reduce((sum, r) => sum + r.count, 0);
    expect(overTimeTotal).toBe(30); // all statuses (existing contract)

    expect(checkInRate).toBeCloseTo((9 / 25) * 100, 5);

    expect(capacityUtilization).toHaveLength(3);
    const e3Util = capacityUtilization.find((c) => String(c._id) === String(e3._id));
    expect(e3Util.registered).toBe(6); // existing contract: all registrations regardless of status
    expect(e3Util.utilization).toBeCloseTo((6 / 20) * 100, 5);
  });
});

describe('Step 22 regression: stability and dashboard', () => {
  test('analytics totals remain identical after paginated requests', async () => {
    const event = await makeEvent(1, 5, 50);
    for (let i = 0; i < 15; i++) {
      const u = await User.create({
        name: `L${i}`, email: `l${i}-${Date.now()}@test.com`, password: 'secret123', role: 'attendee',
      });
      await registerFor(event, u._id, 'confirmed', i % 3 === 0);
    }

    const before = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${adminToken}`);

    // Simulate browsing paginated lists between analytics loads.
    await request(app).get('/api/events?page=1&limit=5');
    await request(app).get('/api/events?page=2&limit=5');
    await request(app)
      .get(`/api/admin/events/${event._id}/attendees?page=1&limit=3`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .get('/api/admin/events?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    const after = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${adminToken}`);
    expect(after.body).toEqual(before.body);
    const total = after.body.registrationsPerEvent.reduce((s, r) => s + r.count, 0);
    expect(total).toBe(15);
  });

  test('dashboard summary counts remain global and correct', async () => {
    await makeEvent(1, 5); // future + published => upcoming
    await makeEvent(2, -5); // past
    const u = await User.create({
      name: 'D', email: `d-${Date.now()}@test.com`, password: 'secret123', role: 'attendee',
    });
    const ev = await makeEvent(3, 5); // future + published => upcoming
    await registerFor(ev, u._id, 'confirmed', true);

    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalEvents).toBe(3);
    expect(res.body.totalRegistrations).toBe(1);
    expect(res.body.checkedInAttendees).toBe(1);
    expect(res.body.upcomingEvents).toBe(2);
  });
});

describe('Event CRUD regression (Step 24 baseline)', () => {
  test('organizer can create, update, publish, and delete an event', async () => {
    const organizer = await User.create({
      name: 'Org', email: `org-${Date.now()}@test.com`, password: 'secret123', role: 'organizer',
    });
    const token = authToken({ userId: organizer._id, role: 'organizer' });

    const create = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'CRUD Event',
        description: 'desc',
        category: 'Music',
        date: daysFromOffset(10).toISOString(),
        time: '10:00 AM',
        location: 'Hall',
        city: 'Nairobi',
        capacity: 10,
        price: 0,
      });
    expect(create.status).toBe(201);
    const id = create.body._id;
    expect(create.body.status).toBe('draft');

    const update = await request(app)
      .put(`/api/events/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'CRUD Event Updated' });
    expect(update.status).toBe(200);
    expect(update.body.title).toBe('CRUD Event Updated');

    const publish = await request(app)
      .patch(`/api/events/${id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(publish.status).toBe(200);
    expect(publish.body.status).toBe('published');

    const list = await request(app).get('/api/events?search=CRUD');
    expect(list.body.pagination.totalItems).toBe(1);

    const remove = await request(app)
      .delete(`/api/events/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remove.status).toBe(200);

    const after = await request(app).get('/api/events?search=CRUD');
    expect(after.body.pagination.totalItems).toBe(0);
  });

  test('unauthenticated users cannot create events', async () => {
    const res = await request(app).post('/api/events').send({});
    expect(res.status).toBe(401);
  });
});

