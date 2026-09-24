describe('sendEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  function setupEnv() {
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_USER = 'test@test.com';
    process.env.EMAIL_PASS = 'password';
    process.env.EMAIL_FROM = 'Test <test@test.com>';
  }

  function clearEnv() {
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.EMAIL_FROM;
  }

  it('throws when transporter is not configured', async () => {
    clearEnv();
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn(),
    }));
    const { sendEmail } = require('../services/emailService');
    await expect(sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>Test</p>' }))
      .rejects.toThrow('Email transporter not configured');
  });

  it('throws when recipient is invalid', async () => {
    setupEnv();
    const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-message-id' });
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail }),
    }));
    const { sendEmail } = require('../services/emailService');
    await expect(sendEmail({ to: 'invalid', subject: 'Test', html: '<p>Test</p>' }))
      .rejects.toThrow('Invalid recipient email address');
  });

  it('sends email with correct options', async () => {
    setupEnv();
    const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-message-id' });
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail }),
    }));
    const { sendEmail } = require('../services/emailService');
    const result = await sendEmail({
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(result.messageId).toBe('mock-message-id');
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'Test <test@test.com>',
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('falls back to EMAIL_USER when EMAIL_FROM is not set', async () => {
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_USER = 'test@test.com';
    process.env.EMAIL_PASS = 'password';
    delete process.env.EMAIL_FROM;

    const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-message-id' });
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail }),
    }));
    const { sendEmail } = require('../services/emailService');
    const result = await sendEmail({
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(result.messageId).toBe('mock-message-id');
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'test@test.com',
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });
});

describe('verifyTransporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  function setupEnv() {
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_USER = 'test@test.com';
    process.env.EMAIL_PASS = 'password';
    process.env.EMAIL_FROM = 'Test <test@test.com>';
  }

  function clearEnv() {
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.EMAIL_FROM;
  }

  it('returns false when transporter is not configured', async () => {
    clearEnv();
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn(),
    }));
    const { verifyTransporter } = require('../services/emailService');
    const result = await verifyTransporter();
    expect(result).toBe(false);
  });

  it('returns true after successful verification', async () => {
    setupEnv();
    const mockVerify = jest.fn().mockResolvedValue(undefined);
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({
        verify: mockVerify,
        sendMail: jest.fn(),
      }),
    }));
    const { verifyTransporter } = require('../services/emailService');
    const result = await verifyTransporter();
    expect(result).toBe(true);
    expect(mockVerify).toHaveBeenCalled();
  });

  it('returns false when verification fails', async () => {
    setupEnv();
    const mockVerify = jest.fn().mockRejectedValue(new Error('Connection refused'));
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({
        verify: mockVerify,
        sendMail: jest.fn(),
      }),
    }));
    const { verifyTransporter } = require('../services/emailService');
    const result = await verifyTransporter();
    expect(result).toBe(false);
  });
});

describe('testEmailConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  function setupEnv() {
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_USER = 'test@test.com';
    process.env.EMAIL_PASS = 'password';
    process.env.EMAIL_FROM = 'Test <test@test.com>';
  }

  function clearEnv() {
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.EMAIL_FROM;
  }

  it('returns configured false when transporter missing', async () => {
    clearEnv();
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn(),
    }));
    const { testEmailConfiguration } = require('../services/emailService');
    const result = await testEmailConfiguration();
    expect(result).toEqual({ configured: false, reason: 'Missing email configuration' });
  });

  it('returns configured true when transporter is valid', async () => {
    setupEnv();
    const mockVerify = jest.fn().mockResolvedValue(undefined);
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({
        verify: mockVerify,
        sendMail: jest.fn(),
      }),
    }));
    const { testEmailConfiguration } = require('../services/emailService');
    const result = await testEmailConfiguration();
    expect(result).toEqual({ configured: true });
  });
});

describe('sendRegistrationConfirmationEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  function setupEnv() {
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_USER = 'test@test.com';
    process.env.EMAIL_PASS = 'password';
    process.env.EMAIL_FROM = 'Test <test@test.com>';
  }

  function clearEnv() {
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.EMAIL_FROM;
  }

  it('returns failure for invalid user email', async () => {
    clearEnv();
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn(),
    }));
    const { sendRegistrationConfirmationEmail } = require('../services/emailService');
    const user = { _id: 'user1', name: 'Test', email: '' };
    const event = { _id: 'event1', title: 'Event' };
    const registration = { _id: 'reg1', ticketNumber: 'EVT-ABC' };

    const result = await sendRegistrationConfirmationEmail(user, event, registration, 'http://localhost:3000');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('Invalid recipient email');
  });

  it('returns failure when email transport fails', async () => {
    setupEnv();
    const mockSendMail = jest.fn().mockRejectedValue(new Error('SMTP error'));
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail, verify: jest.fn() }),
    }));
    const { sendRegistrationConfirmationEmail } = require('../services/emailService');
    const user = { _id: 'user1', name: 'Test User', email: 'user@example.com' };
    const event = { _id: 'event1', title: 'Test Event', date: '2026-10-01', time: '10:00', location: 'Hall', city: 'City' };
    const registration = { _id: 'reg1', ticketNumber: 'EVT-ABC' };

    const result = await sendRegistrationConfirmationEmail(user, event, registration, 'http://localhost:3000');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('SMTP error');
  });

  it('returns success when email is sent', async () => {
    setupEnv();
    const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-id' });
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail, verify: jest.fn() }),
    }));
    const { sendRegistrationConfirmationEmail } = require('../services/emailService');
    const user = { _id: 'user1', name: 'Test User', email: 'user@example.com' };
    const event = { _id: 'event1', title: 'Test Event', date: '2026-10-01', time: '10:00', location: 'Hall', city: 'City' };
    const registration = { _id: 'reg1', ticketNumber: 'EVT-ABC' };

    const result = await sendRegistrationConfirmationEmail(user, event, registration, 'http://localhost:3000');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('mock-id');
  });
});
