const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const registrationRoutes = require('../src/routes/registrationRoutes');
const authMiddleware = require('../src/middleware/authMiddleware');
const { initializeEmailService, setTestTransporter, clearTestTransporter } = require('../src/services/emailService');
const nodemailer = require('nodemailer');

const authorizationFor = (token) => ({ Authorization: ['Bearer', token].join(' ') });

const app = express();
app.use(express.json());
app.use('/api/registrations', registrationRoutes);

const createAuthMiddleware = (user) => {
  return (req, res, next) => {
    req.user = {
      userId: user._id.toString(),
      _id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    next();
  };
};

describe('Registration API', () => {
  let user, event, organizer, token;

  beforeEach(async () => {
    user = await global.testUtils.createUser({ name: 'Attendee', email: 'attendee@example.com' });
    organizer = await global.testUtils.createUser({ name: 'Organizer', email: 'organizer@example.com', role: 'organizer' });
    event = await global.testUtils.createEvent({ organizer: organizer._id, capacity: 2 });
    token = global.testUtils.getAuthToken(user);
  });

  describe('POST /api/registrations', () => {
    test('creates registration and sends confirmation email', async () => {
      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      expect(response.body.message).toBe('Successfully registered for the event.');
      expect(response.body.registration).toBeDefined();
      expect(response.body.registration.ticketNumber).toBeDefined();
      expect(response.body.registration.status).toBe('confirmed');
      expect(response.body.email).toBeDefined();
      expect(response.body.email.status).toBe('sent');
      expect(global.sentEmails.length).toBe(1);
    });

    test('returns ticket number in response', async () => {
      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      expect(response.body.registration.ticketNumber).toMatch(/^EVT-/);
    });

    test('includes event details in response', async () => {
      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      expect(response.body.registration.event).toBeDefined();
      expect(response.body.registration.event.title).toBe(event.title);
    });

    test('prevents duplicate registration', async () => {
      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(409);

      expect(response.body.message).toContain('already registered');
    });

    test('does not send duplicate email for duplicate registration attempt', async () => {
      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      const initialEmailCount = global.sentEmails.length;

      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(409);

      expect(global.sentEmails.length).toBe(initialEmailCount);
    });

    test('reactivates cancelled registration and sends email', async () => {
      const registration = await global.testUtils.createRegistration({ 
        user: user._id, 
        event: event._id,
        status: 'cancelled',
      });

      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      expect(response.body.registration.ticketNumber).not.toBe(registration.ticketNumber);
      expect(response.body.email.status).toBe('sent');
    });

    test('does not reactivate a cancelled registration when the event is full', async () => {
      event.capacity = 1;
      await event.save();
      const previousRegistration = await global.testUtils.createRegistration({
        user: user._id,
        event: event._id,
        status: 'cancelled',
        ticketNumber: 'EVT-OLDTICKET',
      });
      const otherAttendee = await global.testUtils.createUser({ email: 'capacity-attendee@example.com' });
      await global.testUtils.createRegistration({ user: otherAttendee._id, event: event._id });

      await request(app)
        .post('/api/registrations')
        .set(authorizationFor(token))
        .send({ eventId: event._id.toString() })
        .expect(400);

      const unchanged = await require('../src/models/Registration').findById(previousRegistration._id);
      expect(unchanged.status).toBe('cancelled');
      expect(unchanged.ticketNumber).toBe('EVT-OLDTICKET');
    });

    test('returns 404 for non-existent event', async () => {
      const fakeEventId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: fakeEventId.toString() })
        .expect(404);

      expect(response.body.message).toBe('Event not found');
    });

    test('returns 400 for unpublished event', async () => {
      const draftEvent = await global.testUtils.createEvent({ 
        organizer: organizer._id, 
        status: 'draft' 
      });

      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: draftEvent._id.toString() })
        .expect(400);

      expect(response.body.message).toBe('Event is not published');
    });

    test('returns 400 for cancelled event', async () => {
      const cancelledEvent = await global.testUtils.createEvent({
        organizer: organizer._id,
        status: 'cancelled',
      });

      const response = await request(app)
        .post('/api/registrations')
        .set(authorizationFor(token))
        .send({ eventId: cancelledEvent._id.toString() })
        .expect(400);

      expect(response.body.message).toBe('Event is not published');
    });

    test('returns 400 for past event', async () => {
      const pastEvent = await global.testUtils.createEvent({ 
        organizer: organizer._id,
        date: new Date(Date.now() - 86400000),
      });

      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: pastEvent._id.toString() })
        .expect(400);

      expect(response.body.message).toBe('Event is in the past');
    });

    test('returns 400 when event is full', async () => {
      const user2 = await global.testUtils.createUser({ email: 'user2@example.com' });
      const user3 = await global.testUtils.createUser({ email: 'user3@example.com' });
      const token2 = global.testUtils.getAuthToken(user2);
      const token3 = global.testUtils.getAuthToken(user3);

      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token2}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token3}`)
        .send({ eventId: event._id.toString() })
        .expect(400);

      expect(response.body.message).toContain('full');
    });

    test('returns 400 for invalid event ID', async () => {
      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: 'invalid-id' })
        .expect(400);

      expect(response.body.message).toBe('Invalid event ID');
    });

    test('returns 400 for missing event ID', async () => {
      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Event ID is required');
    });

    test('requires authentication', async () => {
      const response = await request(app)
        .post('/api/registrations')
        .send({ eventId: event._id.toString() })
        .expect(401);
    });

    test('email failure does not prevent registration', async () => {
      const failingTransport = nodemailer.createTransport({
        sendMail: () => Promise.reject(new Error('SMTP failed')),
      });
      const originalTransport = require('../src/services/emailService').testTransporter;
      setTestTransporter(failingTransport);

      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      expect(response.body.registration).toBeDefined();
      expect(response.body.email.status).toBe('failed');
      
      setTestTransporter(originalTransport);
    });

    test('registration persists even when email fails', async () => {
      const failingTransport = nodemailer.createTransport({
        sendMail: () => Promise.reject(new Error('SMTP failed')),
      });
      const originalTransport = require('../src/services/emailService').testTransporter;
      setTestTransporter(failingTransport);

      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      const registrations = await global.testUtils.createRegistration({ user: user._id, event: event._id });
      const found = await require('../src/models/Registration').findOne({ user: user._id, event: event._id });
      expect(found).toBeDefined();
      expect(found.status).toBe('confirmed');
      
      setTestTransporter(originalTransport);
    });
  });

  describe('GET /api/registrations/my', () => {
    test('returns user registrations', async () => {
      await global.testUtils.createRegistration({ user: user._id, event: event._id });

      const response = await request(app)
        .get('/api/registrations/my')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.registrations.length).toBe(1);
    });

    test('only returns confirmed registrations', async () => {
      await global.testUtils.createRegistration({ user: user._id, event: event._id, status: 'confirmed' });
      await global.testUtils.createRegistration({ user: user._id, event: event._id, status: 'cancelled' });

      const response = await request(app)
        .get('/api/registrations/my')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.count).toBe(1);
    });
  });

  describe('GET /api/registrations/my-events', () => {
    test('returns upcoming and past events', async () => {
      const futureEvent = await global.testUtils.createEvent({ organizer: organizer._id, date: new Date(Date.now() + 86400000) });
      const pastEvent = await global.testUtils.createEvent({ organizer: organizer._id, date: new Date(Date.now() - 86400000) });
      
      await global.testUtils.createRegistration({ user: user._id, event: futureEvent._id });
      await global.testUtils.createRegistration({ user: user._id, event: pastEvent._id });

      const response = await request(app)
        .get('/api/registrations/my-events')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.upcoming.length).toBe(1);
      expect(response.body.past.length).toBe(1);
      expect(response.body.count.upcoming).toBe(1);
      expect(response.body.count.past).toBe(1);
      expect(response.body.count.total).toBe(2);
    });
  });

  describe('DELETE /api/registrations/:id', () => {
    test('cancels own registration', async () => {
      const registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });

      const response = await request(app)
        .delete(`/api/registrations/${registration._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.message).toContain('cancelled');

      const updated = await require('../src/models/Registration').findById(registration._id);
      expect(updated.status).toBe('cancelled');
    });

    test('returns 403 for cancelling another user registration', async () => {
      const otherUser = await global.testUtils.createUser({ email: 'other@example.com' });
      const registration = await global.testUtils.createRegistration({ user: otherUser._id, event: event._id });

      const response = await request(app)
        .delete(`/api/registrations/${registration._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.message).toBe('Not authorized');
    });

    test('does not allow an organizer to cancel registrations for another organizer event', async () => {
      const otherOrganizer = await global.testUtils.createUser({
        role: 'organizer',
        email: 'other-registration-organizer@example.com',
      });
      const otherEvent = await global.testUtils.createEvent({ organizer: otherOrganizer._id });
      const registration = await global.testUtils.createRegistration({ user: user._id, event: otherEvent._id });

      const response = await request(app)
        .delete(`/api/registrations/${registration._id}`)
        .set(authorizationFor(global.testUtils.getAuthToken(organizer)))
        .expect(403);

      expect(response.body.message).toBe('Not authorized');
      expect((await require('../src/models/Registration').findById(registration._id)).status).toBe('confirmed');
    });

    test('allows admin to cancel any registration', async () => {
      const admin = await global.testUtils.createUser({ email: 'admin@example.com', role: 'admin' });
      const adminToken = global.testUtils.getAuthToken(admin);
      const otherUser = await global.testUtils.createUser({ email: 'other@example.com' });
      const registration = await global.testUtils.createRegistration({ user: otherUser._id, event: event._id });

      const response = await request(app)
        .delete(`/api/registrations/${registration._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain('cancelled');
    });
  });

  describe('GET /api/registrations/:id', () => {
    test('returns registration details', async () => {
      const registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body._id).toBe(registration._id.toString());
      expect(response.body.ticketNumber).toBe(registration.ticketNumber);
    });

    test('returns 404 for non-existent registration', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/registrations/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.message).toBe('Registration not found');
    });
  });

  describe('GET /api/registrations/:registrationId/ticket', () => {
    test('returns ticket for registration owner', async () => {
      const registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ticket).toBeDefined();
      expect(response.body.ticket.ticketNumber).toBe(registration.ticketNumber);
      expect(response.body.ticket.status).toBe('confirmed');
      expect(response.body.ticket.attendee).toBeDefined();
      expect(response.body.ticket.attendee.name).toBe(user.name);
      expect(response.body.ticket.attendee.email).toBe(user.email);
      expect(response.body.ticket.event).toBeDefined();
      expect(response.body.ticket.event.title).toBe(event.title);
      expect(response.body.ticket.event.date).toBeDefined();
      expect(response.body.ticket.event.location).toBe(event.location);
      expect(response.body.ticket.event.city).toBe(event.city);
      expect(response.body.ticket.registeredAt).toBeDefined();
      // QR code tests
      expect(response.body.ticket.qrCode).toBeDefined();
      expect(response.body.ticket.qrCode).toMatch(/^data:image\/png;base64,/);
    });

    test('returns ticket with QR code containing correct payload format', async () => {
      const registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const qrCode = response.body.ticket.qrCode;
      expect(qrCode).toBeDefined();
      // Verify it's a valid base64 PNG data URL
      const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4E);
      expect(buffer[3]).toBe(0x47);
    });

    test('returns 401 for unauthenticated request', async () => {
      const registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .expect(401);
    });

    test('returns 403 when accessing another user ticket', async () => {
      const otherUser = await global.testUtils.createUser({ email: 'other@example.com' });
      const registration = await global.testUtils.createRegistration({ user: otherUser._id, event: event._id });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.message).toBe('Not authorized');
    });

    test('returns 404 for non-existent registration', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/registrations/${fakeId}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.message).toBe('Registration not found');
    });

    test('handles malformed registration ID safely', async () => {
      const response = await request(app)
        .get('/api/registrations/invalid-id/ticket')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    test('handles registration without associated event gracefully', async () => {
      const registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });
      // Delete the event to simulate missing event
      await require('../src/models/Event').findByIdAndDelete(event._id);

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ticket.event).toBeNull();
    });

    test('returns cancelled status for cancelled registration', async () => {
      const registration = await global.testUtils.createRegistration({ 
        user: user._id, 
        event: event._id,
        status: 'cancelled',
      });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ticket.status).toBe('cancelled');
    });

    test('ticket response includes correct persisted ticket reference', async () => {
      const registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });

      const response1 = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const response2 = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response1.body.ticket.ticketNumber).toBe(response2.body.ticket.ticketNumber);
      expect(response1.body.ticket.ticketNumber).toBe(registration.ticketNumber);
    });

    test('does not create new registration or ticket on repeated requests', async () => {
      const registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });
      const initialCount = await require('../src/models/Registration').countDocuments();

      await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const finalCount = await require('../src/models/Registration').countDocuments();
      expect(finalCount).toBe(initialCount);
    });

    test('does not return private user fields', async () => {
      const registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.ticket.attendee).toBeDefined();
      expect(response.body.ticket.attendee.name).toBe(user.name);
      expect(response.body.ticket.attendee.email).toBe(user.email);
      expect(response.body.ticket.attendee.password).toBeUndefined();
      expect(response.body.ticket.attendee._id).toBeUndefined();
      expect(response.body.ticket.attendee.role).toBeUndefined();
    });

    test('allows admin to access any ticket', async () => {
      const admin = await global.testUtils.createUser({ email: 'admin@example.com', role: 'admin' });
      const adminToken = global.testUtils.getAuthToken(admin);
      const otherUser = await global.testUtils.createUser({ email: 'other@example.com' });
      const registration = await global.testUtils.createRegistration({ user: otherUser._id, event: event._id });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ticket.ticketNumber).toBe(registration.ticketNumber);
    });

    test('allows organizer to access tickets for their own event', async () => {
      const organizerToken = global.testUtils.getAuthToken(organizer);
      const otherUser = await global.testUtils.createUser({ email: 'other@example.com' });
      const registration = await global.testUtils.createRegistration({ user: otherUser._id, event: event._id });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ticket.ticketNumber).toBe(registration.ticketNumber);
    });

    test('denies organizer access to tickets for events they do not own', async () => {
      const otherOrganizer = await global.testUtils.createUser({
        role: 'organizer',
        email: 'other-ticket-organizer@example.com',
      });
      const otherEvent = await global.testUtils.createEvent({ organizer: otherOrganizer._id });
      const registration = await global.testUtils.createRegistration({ user: user._id, event: otherEvent._id });

      const response = await request(app)
        .get(`/api/registrations/${registration._id}/ticket`)
        .set(authorizationFor(global.testUtils.getAuthToken(organizer)))
        .expect(403);

      expect(response.body.message).toBe('Not authorized');
    });
  });
});