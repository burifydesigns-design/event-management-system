const { sendRegistrationConfirmation, buildRegistrationConfirmationEmail, escapeHtml, formatEventDate, initializeEmailService, setTestTransporter, clearTestTransporter } = require('../src/services/emailService');
const Registration = require('../src/models/Registration');
const Event = require('../src/models/Event');
const User = require('../src/models/User');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

describe('Email Service', () => {
  beforeAll(() => {
    global.sentEmails = [];
  });

  afterEach(() => {
    global.sentEmails = [];
  });

  describe('escapeHtml', () => {
    test('escapes HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('<script>alert("xss")</script>');
    });

    test('escapes ampersand', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom & Jerry');
    });

    test('escapes quotes', () => {
      expect(escapeHtml('He said "hello"')).toBe('He said "hello"');
    });

    test('handles null/undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    test('handles empty string', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('formatEventDate', () => {
    test('formats valid date', () => {
      const date = new Date('2026-10-20T10:00:00Z');
      const result = formatEventDate(date);
      expect(result).toContain('October');
      expect(result).toContain('2026');
      expect(result).toContain('20');
    });

    test('handles null', () => {
      expect(formatEventDate(null)).toBe('TBD');
    });

    test('handles undefined', () => {
      expect(formatEventDate(undefined)).toBe('TBD');
    });

    test('handles invalid date', () => {
      expect(formatEventDate('invalid')).toBe('TBD');
    });
  });

  describe('buildRegistrationConfirmationEmail', () => {
    const mockRegistration = {
      _id: '507f1f77bcf86cd799439011',
      ticketNumber: 'EVT-ABC123',
    };

    const mockEvent = {
      title: 'React Workshop',
      date: '2026-10-20T10:00:00Z',
      time: '10:00 AM',
      location: 'Conference Hall',
      city: 'Nairobi',
    };

    const mockUser = {
      name: 'John Doe',
      email: 'john@example.com',
    };

    test('generates correct subject', () => {
      const { subject } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, mockUser);
      expect(subject).toBe('Registration confirmed: React Workshop');
    });

    test('includes attendee name in HTML', () => {
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, mockUser);
      expect(html).toContain('John Doe');
    });

    test('includes event title in HTML', () => {
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, mockUser);
      expect(html).toContain('React Workshop');
    });

    test('includes formatted date in HTML', () => {
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, mockUser);
      expect(html).toContain('October');
      expect(html).toContain('2026');
    });

    test('includes time in HTML', () => {
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, mockUser);
      expect(html).toContain('10:00 AM');
    });

    test('includes location and city in HTML', () => {
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, mockUser);
      expect(html).toContain('Conference Hall');
      expect(html).toContain('Nairobi');
    });

    test('includes ticket number in HTML', () => {
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, mockUser);
      expect(html).toContain('EVT-ABC123');
    });

    test('includes ticket link in HTML', () => {
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, mockUser);
      expect(html).toContain('/my-ticket/507f1f77bcf86cd799439011');
    });

    test('generates plain text version', () => {
      const { text } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, mockUser);
      expect(text).toContain('John Doe');
      expect(text).toContain('React Workshop');
      expect(text).toContain('EVT-ABC123');
    });

    test('handles missing city', () => {
      const eventNoCity = { ...mockEvent, city: '' };
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, eventNoCity, mockUser);
      expect(html).toContain('Conference Hall');
    });

    test('escapes user-provided content', () => {
      const maliciousUser = { name: '<script>alert(1)</script>', email: 'test@test.com' };
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, mockEvent, maliciousUser);
      expect(html).not.toContain('<script>');
      expect(html).toContain('<script>');
    });

    test('handles missing event data', () => {
      const eventMinimal = { title: 'Test Event' };
      const { html } = buildRegistrationConfirmationEmail(mockRegistration, eventMinimal, mockUser);
      expect(html).toContain('Test Event');
      expect(html).toContain('TBD');
    });
  });

  describe('sendRegistrationConfirmation', () => {
    let user, event, registration;

    beforeEach(async () => {
      user = await global.testUtils.createUser({ name: 'Test User', email: 'test@example.com' });
      event = await global.testUtils.createEvent({ organizer: user._id, capacity: 50 });
      registration = await global.testUtils.createRegistration({ user: user._id, event: event._id });
    });

    test('sends email successfully', async () => {
      const result = await sendRegistrationConfirmation({ registrationId: registration._id });
      expect(result.status).toBe('sent');
      expect(result.messageId).toBeDefined();
      expect(global.sentEmails.length).toBe(1);
    });

    test('includes correct recipient', async () => {
      await sendRegistrationConfirmation({ registrationId: registration._id });
      const email = global.sentEmails[0];
      expect(email.message.to).toContain('test@example.com');
    });

    test('includes correct subject', async () => {
      await sendRegistrationConfirmation({ registrationId: registration._id });
      const email = global.sentEmails[0];
      expect(email.message.subject).toContain('Registration confirmed');
      expect(email.message.subject).toContain(event.title);
    });

    test('includes ticket number in email', async () => {
      await sendRegistrationConfirmation({ registrationId: registration._id });
      const email = global.sentEmails[0];
      expect(email.message.html).toContain(registration.ticketNumber);
    });

    test('includes event date and location', async () => {
      await sendRegistrationConfirmation({ registrationId: registration._id });
      const email = global.sentEmails[0];
      expect(email.message.html).toContain(event.location);
      expect(email.message.html).toContain(event.city);
    });

    test('returns not_found for missing registration', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const result = await sendRegistrationConfirmation({ registrationId: fakeId });
      expect(result.status).toBe('not_found');
    });

    test('returns skipped for cancelled registration', async () => {
      registration.status = 'cancelled';
      await registration.save();
      const result = await sendRegistrationConfirmation({ registrationId: registration._id });
      expect(result.status).toBe('skipped');
    });

    test('returns failed for missing ticket number', async () => {
      registration.ticketNumber = null;
      await registration.save();
      const result = await sendRegistrationConfirmation({ registrationId: registration._id });
      expect(result.status).toBe('failed');
    });

    test('returns no_recipient for user without email', async () => {
      const userNoEmail = await global.testUtils.createUser({ name: 'No Email', email: 'noemail@example.com' });
      userNoEmail.email = undefined;
      await userNoEmail.save();
      
      const regNoEmail = await global.testUtils.createRegistration({ user: userNoEmail._id, event: event._id });
      const result = await sendRegistrationConfirmation({ registrationId: regNoEmail._id });
      expect(result.status).toBe('no_recipient');
    });

    test('returns failed for missing event', async () => {
      const regNoEvent = await global.testUtils.createRegistration({ user: user._id, event: new mongoose.Types.ObjectId() });
      const result = await sendRegistrationConfirmation({ registrationId: regNoEvent._id });
      expect(result.status).toBe('failed');
    });

    test('handles SMTP failure gracefully', async () => {
      const failingTransport = nodemailer.createTransport({
        sendMail: () => Promise.reject(new Error('SMTP connection failed')),
      });
      setTestTransporter(failingTransport);
      
      const result = await sendRegistrationConfirmation({ registrationId: registration._id });
      expect(result.status).toBe('failed');
      expect(result.message).toContain('SMTP');
      
      // Restore the test transport
      const testTransport = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
      testTransport.on('message', (message) => {
        if (!global.sentEmails) global.sentEmails = [];
        global.sentEmails.push(message);
      });
      setTestTransporter(testTransport);
    });
  });

  describe('initializeEmailService', () => {
    test('returns false when not configured', () => {
      const originalEnv = { ...process.env };
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.EMAIL_FROM;
      
      const result = initializeEmailService();
      expect(result).toBe(false);
      
      process.env = originalEnv;
    });
  });
});