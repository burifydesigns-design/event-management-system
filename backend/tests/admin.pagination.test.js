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
let otherAttendeeToken;
let adminId;
let eventId;

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

async function seedEvent(count, overrides = {}) {
  const event = await Event.create({
    title: `Mega Event ${count}`,
    description: 'Big event',
    category: 'Music',
    date: daysFromNow(10),
    time: '10:00 AM',
    location: 'Stadium',
    city: 'Nairobi',
    capacity: 500,
    price: 10,
    organizer: adminId,
    status: 'published',
    ...overrides,
  });
  return event;
}

async function seedRegistrations(eventDoc, count, { prefix = 'user', ticketPrefix = 'T' } = {}) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push({
      name: `${prefix} ${i + 1}`,
      email: `${prefix}${i + 1}-${Date.now()}@test.com`,
      password: 'secret123',
      role: 'attendee',
    });
  }
  const created = await User.create(users);
  const regs = created.map((u, i) => ({
    user: u._id,
    event: eventDoc._id,
    ticketNumber: `${ticketPrefix}-${i + 1}-${Date.now()}`,
    status: 'confirmed',
  }));
  await Registration.create(regs);
  return created;
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

  const other = await User.create({
    name: 'Other', email: `oth-${Date.now()}@test.com`, password: 'secret123', role: 'attendee',
  });
  otherAttendeeToken = authToken({ userId: other._id, role: 'attendee' });
});

describe('GET /api/admin/events - admin event management list', () => {
  test('requires authentication', async () => {
    const res = await request(app).get('/api/admin/events');
    expect(res.status).toBe(401);
  });

  test('rejects non-admin roles', async () => {
    const res = await request(app).get('/api/admin/events').set('Authorization', `Bearer ${attendeeToken}`);
    expect(res.status).toBe(403);
  });

  test('returns paginated events including drafts with registration counts', async () => {
    for (let i = 0; i < 7; i++) await seedEvent(i);
    await Event.create({
      title: 'Draft Event', description: 'd', category: 'Music', date: daysFromNow(20),
      time: '9:00 AM', location: 'X', city: 'Nairobi', capacity: 50, price: 0,
      organizer: adminId, status: 'draft',
    });

    const res = await request(app)
      .get('/api/admin/events?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.pagination.totalItems).toBe(8);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.data[0]).toHaveProperty('registeredCount');
    expect(res.body.data[0]).toHaveProperty('status');
  });

  test('status filter narrows results before pagination', async () => {
    for (let i = 0; i < 4; i++) await seedEvent(i);
    await seedEvent(99, { status: 'draft', title: 'Only Draft' });

    const res = await request(app)
      .get('/api/admin/events?status=draft&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalItems).toBe(1);
    expect(res.body.data[0].title).toBe('Only Draft');
  });

  test('invalid status filter returns 400', async () => {
    const res = await request(app)
      .get('/api/admin/events?status=weird')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('invalid pagination params return 400', async () => {
    const res = await request(app)
      .get('/api/admin/events?page=-1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/events/:eventId/attendees - paginated attendee list', () => {
  test('requires admin role', async () => {
    const event = await seedEvent(1);
    const res = await request(app)
      .get(`/api/admin/events/${event._id}/attendees`)
      .set('Authorization', `Bearer ${attendeeToken}`);
    expect(res.status).toBe(403);
  });

  test('returns paginated attendees with user details and metadata', async () => {
    const event = await seedEvent(1);
    await seedRegistrations(event, 12);

    const res = await request(app)
      .get(`/api/admin/events/${event._id}/attendees?page=2&limit=5`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.pagination).toEqual({
      page: 2, limit: 5, totalItems: 12, totalPages: 3, hasNextPage: true, hasPreviousPage: true,
    });
    expect(res.body.data[0].user).toHaveProperty('name');
    expect(res.body.data[0].user).toHaveProperty('email');
    expect(res.body.data[0].user).not.toHaveProperty('password');
  });

  test('invalid event ID returns 400', async () => {
    const res = await request(app)
      .get('/api/admin/events/not-an-id/attendees')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('invalid pagination params return 400', async () => {
    const event = await seedEvent(1);
    const res = await request(app)
      .get(`/api/admin/events/${event._id}/attendees?limit=-3`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('attendee data is scoped to the requested event only', async () => {
    const eventA = await seedEvent(1, { title: 'Event A' });
    const eventB = await seedEvent(2, { title: 'Event B' });
    await seedRegistrations(eventA, 3, { prefix: 'a', ticketPrefix: 'A' });
    await seedRegistrations(eventB, 4, { prefix: 'b', ticketPrefix: 'B' });

    const res = await request(app)
      .get(`/api/admin/events/${eventA._id}/attendees?limit=50`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.pagination.totalItems).toBe(3);
  });
});

describe('Step 23 regression: CSV export of attendees', () => {
  test('exports ALL registrations, not just the current page', async () => {
    const event = await seedEvent(1);
    await seedRegistrations(event, 15);

    // Paginate the list endpoint first to prove export is unaffected.
    await request(app)
      .get(`/api/admin/events/${event._id}/attendees?page=1&limit=5`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get(`/api/admin/events/${event._id}/attendees/export`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);

    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('Name,Email,Event,Ticket Number,Registration Date,Registration Status,Check-in Status');
    expect(lines).toHaveLength(16); // header + 15 rows
    expect(res.text).toContain('Mega Event');
  });

  test('requires admin role', async () => {
    const event = await seedEvent(1);
    const res = await request(app)
      .get(`/api/admin/events/${event._id}/attendees/export`)
      .set('Authorization', `Bearer ${attendeeToken}`);
    expect(res.status).toBe(403);
  });

  test('escapes double quotes in CSV fields', async () => {
    const event = await seedEvent(1, { title: 'He said "Wow" Event' });
    const user = await User.create({
      name: 'Quote "Lover"', email: `q-${Date.now()}@test.com`, password: 'secret123', role: 'attendee',
    });
    await Registration.create({
      user: user._id, event: event._id, ticketNumber: `Q-${Date.now()}`, status: 'confirmed',
    });

    const res = await request(app)
      .get(`/api/admin/events/${event._id}/attendees/export`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('""Lover""');
    expect(res.text).toContain('""Wow""');
  });

  test('exports an empty dataset as header-only CSV', async () => {
    const event = await seedEvent(1);
    const res = await request(app)
      .get(`/api/admin/events/${event._id}/attendees/export`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.text.trim().split('\n')).toHaveLength(1);
  });
});

