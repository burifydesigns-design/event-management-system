const request = require('supertest');
const express = require('express');
const adminRoutes = require('../src/routes/adminRoutes');
const authRoutes = require('../src/routes/authRoutes');
const eventRoutes = require('../src/routes/eventRoutes');
const reportRoutes = require('../src/routes/reportRoutes');
const ticketRoutes = require('../src/routes/ticketRoutes');
const orderRoutes = require('../src/routes/orderRoutes');
const Registration = require('../src/models/Registration');
const Event = require('../src/models/Event');
const TicketType = require('../src/models/TicketType');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/orders', orderRoutes);

const eventPayload = (overrides = {}) => ({
  title: 'Dashboard Test Event',
  description: 'Event details for admin dashboard tests.',
  category: 'Workshop',
  date: new Date(Date.now() + 86400000).toISOString(),
  time: '18:30',
  location: 'Main Hall',
  city: 'Test City',
  capacity: 10,
  price: 0,
  ...overrides,
});

const authenticated = (user) => ({
  Authorization: `Bearer ${global.testUtils.getAuthToken(user)}`,
});

describe('Admin dashboard API', () => {
  let admin;
  let organizer;
  let attendee;

  beforeEach(async () => {
    admin = await global.testUtils.createUser({ role: 'admin', email: 'admin-dashboard@example.com' });
    organizer = await global.testUtils.createUser({ role: 'organizer', email: 'organizer-dashboard@example.com' });
    attendee = await global.testUtils.createUser({ role: 'attendee', email: 'attendee-dashboard@example.com' });
  });

  test('requires authentication and administrator role', async () => {
    await request(app).get('/api/admin/dashboard').expect(401);
    await request(app)
      .get('/api/admin/dashboard')
      .set(authenticated(attendee))
      .expect(403);
  });

  test('does not grant admin privileges from public registration input', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Role Tampering Test',
        email: 'role-tampering@example.com',
        password: 'password123',
        role: 'admin',
      })
      .expect(201);

    expect(response.body.user.role).toBe('attendee');
    await request(app)
      .get('/api/admin/dashboard')
      .set({ Authorization: `Bearer ${response.body.token}` })
      .expect(403);
  });

  test('uses the current database role instead of a stale JWT role claim', async () => {
    const oldAdminToken = global.testUtils.getAuthToken(admin);
    admin.role = 'attendee';
    await admin.save();

    await request(app)
      .get('/api/admin/dashboard')
      .set({ Authorization: `Bearer ${oldAdminToken}` })
      .expect(403);
  });

  test('reports counts from stored event and registration records', async () => {
    const upcoming = await global.testUtils.createEvent({
      organizer: organizer._id,
      capacity: 3,
      date: new Date(Date.now() + 86400000),
    });
    const past = await global.testUtils.createEvent({
      organizer: organizer._id,
      capacity: 10,
      date: new Date(Date.now() - 2 * 86400000),
    });
    const cancelled = await global.testUtils.createEvent({
      organizer: organizer._id,
      capacity: 8,
      status: 'cancelled',
      date: new Date(Date.now() + 3 * 86400000),
    });

    await global.testUtils.createRegistration({ user: attendee._id, event: upcoming._id, ticketNumber: 'EVT-COUNT1' });
    await global.testUtils.createRegistration({
      user: attendee._id,
      event: upcoming._id,
      status: 'cancelled',
      ticketNumber: 'EVT-COUNT2',
    });
    await global.testUtils.createRegistration({
      user: attendee._id,
      event: past._id,
      status: 'checked-in',
      ticketNumber: 'EVT-COUNT3',
    });
    await global.testUtils.createRegistration({
      user: attendee._id,
      event: cancelled._id,
      ticketNumber: 'EVT-COUNT4',
    });

    const response = await request(app)
      .get('/api/admin/dashboard')
      .set(authenticated(admin))
      .expect(200);

    expect(response.body.totalEvents).toBe(3);
    expect(response.body.upcomingEvents).toBe(1);
    expect(response.body.pastEvents).toBe(1);
    expect(response.body.totalRegistrations).toBe(4);
    expect(response.body.activeRegistrations).toBe(2);
    expect(response.body.checkedInAttendees).toBe(1);
    expect(response.body.availableSeats).toBe(2);
  });

  test('filters events safely and returns active counts plus registration history presence', async () => {
    const event = await global.testUtils.createEvent({
      organizer: organizer._id,
      title: 'Festival .*',
      city: 'New York',
      capacity: 4,
    });
    await global.testUtils.createRegistration({
      user: attendee._id,
      event: event._id,
      ticketNumber: 'EVT-FILTER1',
    });
    await global.testUtils.createRegistration({
      user: attendee._id,
      event: event._id,
      status: 'cancelled',
      ticketNumber: 'EVT-FILTER2',
    });

    const match = await request(app)
      .get('/api/admin/events')
      .query({ search: '.*', city: 'New York', status: 'published' })
      .set(authenticated(admin))
      .expect(200);
    expect(match.body).toHaveLength(1);
    expect(match.body[0]).toEqual(expect.objectContaining({
      registeredCount: 1,
      hasRegistrations: true,
      organizer: expect.objectContaining({ name: organizer.name, email: organizer.email }),
    }));

    const literalRegexSearch = await request(app)
      .get('/api/admin/events')
      .query({ search: '.*' })
      .set(authenticated(admin))
      .expect(200);
    expect(literalRegexSearch.body).toHaveLength(1);

    await request(app)
      .get('/api/admin/events')
      .query({ status: 'unrecognized' })
      .set(authenticated(admin))
      .expect(400);
  });

  test('restricts event writes to organizers and admins and preserves event ownership', async () => {
    await request(app)
      .post('/api/events')
      .set(authenticated(attendee))
      .send(eventPayload())
      .expect(403);

    const created = await request(app)
      .post('/api/events')
      .set(authenticated(organizer))
      .send(eventPayload({ organizer: admin._id.toString(), status: 'published' }))
      .expect(201);
    expect(created.body.organizer).toBe(organizer._id.toString());
    expect(created.body.status).toBe('draft');

    const otherEvent = await global.testUtils.createEvent({ organizer: admin._id });
    await request(app)
      .put(`/api/events/${otherEvent._id}`)
      .set(authenticated(organizer))
      .send(eventPayload({ title: 'Unauthorized Update' }))
      .expect(403);

    await request(app)
      .put(`/api/events/${created.body._id}`)
      .set(authenticated(admin))
      .send(eventPayload({ title: 'Edited by Admin' }))
      .expect(200);
    const updated = await Event.findById(created.body._id);
    expect(updated.title).toBe('Edited by Admin');
    expect(String(updated.organizer)).toBe(organizer._id.toString());
  });

  test('allows admins to create events without trusting a client-supplied owner', async () => {
    const created = await request(app)
      .post('/api/events')
      .set(authenticated(admin))
      .send(eventPayload({ organizer: organizer._id.toString(), status: 'published' }))
      .expect(201);

    expect(created.body.status).toBe('published');
    expect(created.body.organizer).toBe(admin._id.toString());
  });

  test('limits organizer ticket and sales operations to events they own', async () => {
    const foreignEvent = await global.testUtils.createEvent({ organizer: organizer._id });
    const anotherOrganizer = await global.testUtils.createUser({
      role: 'organizer',
      email: 'scoped-organizer@example.com',
    });
    const ownedEvent = await global.testUtils.createEvent({ organizer: anotherOrganizer._id });

    await request(app)
      .post('/api/tickets')
      .set(authenticated(organizer))
      .send({ event: ownedEvent._id, name: 'VIP', price: 20, quantityAvailable: 5 })
      .expect(403);

    await request(app)
      .post('/api/tickets')
      .set(authenticated(organizer))
      .send({ event: foreignEvent._id, name: 'General', price: 10, quantityAvailable: 10 })
      .expect(201);

    await request(app)
      .get(`/api/reports/event/${ownedEvent._id}`)
      .set(authenticated(organizer))
      .expect(403);
    await request(app)
      .get(`/api/reports/event/${foreignEvent._id}`)
      .set(authenticated(organizer))
      .expect(200);
  });

  test('rejects invalid event capacity and capacity reductions below active registrations', async () => {
    await request(app)
      .post('/api/events')
      .set(authenticated(organizer))
      .send(eventPayload({ capacity: 0 }))
      .expect(400);

    const event = await global.testUtils.createEvent({ organizer: organizer._id, capacity: 2 });
    await global.testUtils.createRegistration({ user: attendee._id, event: event._id });
    await global.testUtils.createRegistration({
      user: organizer._id,
      event: event._id,
      ticketNumber: 'EVT-SECOND-REG',
    });

    await request(app)
      .put(`/api/events/${event._id}`)
      .set(authenticated(organizer))
      .send(eventPayload({ capacity: 1 }))
      .expect(400);
  });

  test('limits attendee details to administrators and necessary registration fields', async () => {
    const event = await global.testUtils.createEvent({ organizer: organizer._id });
    await global.testUtils.createRegistration({ user: attendee._id, event: event._id });

    await request(app)
      .get(`/api/admin/events/${event._id}/attendees`)
      .set(authenticated(attendee))
      .expect(403);

    const response = await request(app)
      .get(`/api/admin/events/${event._id}/attendees`)
      .set(authenticated(admin))
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].user).toEqual({ _id: attendee._id.toString(), name: attendee.name, email: attendee.email });
    expect(Object.keys(response.body[0]).sort()).toEqual([
      '_id',
      'checkedIn',
      'checkedInAt',
      'event',
      'registeredAt',
      'status',
      'ticketNumber',
      'user',
    ]);
    expect(response.body[0].user.password).toBeUndefined();
  });

  test('cancels events with registration records and retains their tickets', async () => {
    const event = await global.testUtils.createEvent({ organizer: organizer._id });
    const registration = await global.testUtils.createRegistration({
      user: attendee._id,
      event: event._id,
      ticketNumber: 'EVT-KEEP123',
    });

    const response = await request(app)
      .delete(`/api/events/${event._id}`)
      .set(authenticated(admin))
      .expect(200);

    expect(response.body.cancelled).toBe(true);
    expect((await Event.findById(event._id)).status).toBe('cancelled');
    expect((await Registration.findById(registration._id)).ticketNumber).toBe('EVT-KEEP123');
  });

  test('does not physically delete ticketed events or allow new orders after cancellation', async () => {
    const event = await global.testUtils.createEvent({ organizer: organizer._id });
    const ticketType = await TicketType.create({
      event: event._id,
      name: 'General Admission',
      price: 25,
      quantityAvailable: 20,
    });

    const response = await request(app)
      .delete(`/api/events/${event._id}`)
      .set(authenticated(admin))
      .expect(200);

    expect(response.body.cancelled).toBe(true);
    expect(await TicketType.findById(ticketType._id)).not.toBeNull();
    await request(app)
      .post('/api/orders')
      .set(authenticated(attendee))
      .send({ eventId: event._id.toString(), ticketTypeId: ticketType._id.toString(), quantity: 1 })
      .expect(400);
  });

  test('deletes events only when there are no registration records', async () => {
    const event = await global.testUtils.createEvent({ organizer: organizer._id });
    const response = await request(app)
      .delete(`/api/events/${event._id}`)
      .set(authenticated(admin))
      .expect(200);

    expect(response.body.deleted).toBe(true);
    expect(await Event.findById(event._id)).toBeNull();
  });

  test('rejects attendee-list requests for invalid or missing events', async () => {
    await request(app)
      .get('/api/admin/events/not-an-id/attendees')
      .set(authenticated(admin))
      .expect(400);
    await request(app)
      .get('/api/admin/events/507f1f77bcf86cd799439011/attendees')
      .set(authenticated(admin))
      .expect(404);
  });
});
