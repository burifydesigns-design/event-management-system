const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const registrationRoutes = require('../src/routes/registrationRoutes');
const authMiddleware = require('../src/middleware/authMiddleware');
const { initializeEmailService, setTestTransporter, clearTestTransporter } = require('../src/services/emailService');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

let testTransport;
let sentEmails = [];

beforeAll(() => {
  testTransport = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
  testTransport.on('message', (message) => {
    sentEmails.push(message);
  });
  setTestTransporter(testTransport);
  initializeEmailService();
});

afterAll(() => {
  clearTestTransporter();
});

beforeEach(() => {
  sentEmails = [];
});

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
      expect(sentEmails.length).toBe(1);
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

      const initialEmailCount = sentEmails.length;

      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(409);

      expect(sentEmails.length).toBe(initialEmailCount);
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
      setTestTransporter(failingTransport);

      const response = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventId: event._id.toString() })
        .expect(201);

      expect(response.body.registration).toBeDefined();
      expect(response.body.email.status).toBe('failed');
      
      setTestTransporter(testTransport);
    });

    test('registration persists even when email fails', async () => {
      const failingTransport = nodemailer.createTransport({
        sendMail: () => Promise.reject(new Error('SMTP failed')),
      });
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
      
      setTestTransporter(testTransport);
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
});