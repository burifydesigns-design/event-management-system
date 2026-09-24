const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const generateTicketNumber = require('../utils/ticketGenerator');
const { sendRegistrationConfirmationEmail } = require('../services/emailService');

jest.mock('../models/Event');
jest.mock('../models/Registration');
jest.mock('../models/User');
jest.mock('../utils/ticketGenerator');
jest.mock('../services/emailService');

function createReqResNext(userId) {
  const req = {
    user: { userId, role: 'attendee' },
    body: {},
    protocol: 'http',
    get: () => 'localhost:3000',
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('registerForEvent', () => {
  let registerForEvent;
  let mockedSendEmail;

  beforeEach(() => {
    jest.clearAllMocks();
    Event.findById.mockReset();
    Event.findOne.mockReset();
    Event.countDocuments.mockReset();
    Event.create.mockReset();
    Registration.findById.mockReset();
    Registration.findOne.mockReset();
    Registration.countDocuments.mockReset();
    Registration.create.mockReset();
    User.findById.mockReset();
    generateTicketNumber.mockReset();
    sendRegistrationConfirmationEmail.mockReset();

    const controller = require('../controllers/registrationController');
    registerForEvent = controller.registerForEvent;
    mockedSendEmail = sendRegistrationConfirmationEmail;
  });

  it('returns 400 when eventId is missing', async () => {
    const { req, res, next } = createReqResNext('user1');
    req.body = {};
    await registerForEvent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Event ID is required' });
  });

  it('returns 400 when eventId is invalid', async () => {
    const { req, res, next } = createReqResNext('user1');
    req.body = { eventId: 'invalid' };
    await registerForEvent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid event ID' });
  });

  it('returns 404 when event not found', async () => {
    Event.findById.mockReturnValue(null);
    const validId = new mongoose.Types.ObjectId().toString();
    const { req, res, next } = createReqResNext('user1');
    req.body = { eventId: validId };
    await registerForEvent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Event not found' });
  });

  it('returns 400 when event is not published', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    Event.findById.mockReturnValue({ status: 'draft', date: new Date(Date.now() + 86400000), _id: validId, title: 'Event' });
    const { req, res, next } = createReqResNext('user1');
    req.body = { eventId: validId };
    await registerForEvent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Event is not published' });
  });

  it('returns 400 when event is in the past', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    Event.findById.mockReturnValue({ status: 'published', date: new Date(Date.now() - 86400000), _id: validId, title: 'Event' });
    const { req, res, next } = createReqResNext('user1');
    req.body = { eventId: validId };
    await registerForEvent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Event is in the past' });
  });

  it('returns 409 when already registered and confirmed', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    Event.findById.mockReturnValue({ status: 'published', date: new Date(Date.now() + 86400000), _id: validId, title: 'Event', capacity: 10 });
    Registration.findOne.mockResolvedValue({ status: 'confirmed', _id: 'reg1' });
    const { req, res, next } = createReqResNext('user1');
    req.body = { eventId: validId };
    await registerForEvent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'You are already registered for this event.' });
  });

  it('returns 400 when event is full', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    Event.findById.mockReturnValue({ status: 'published', date: new Date(Date.now() + 86400000), _id: validId, title: 'Event', capacity: 1 });
    Registration.findOne.mockResolvedValue(null);
    Registration.countDocuments.mockResolvedValue(1);
    const { req, res, next } = createReqResNext('user1');
    req.body = { eventId: validId };
    await registerForEvent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'This event is full.' });
  });

  it('creates registration and sends email on success', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    const mockEvent = { _id: validId, status: 'published', date: new Date(Date.now() + 86400000), capacity: 10, title: 'Event' };
    Event.findById.mockReturnValue(mockEvent);
    Registration.findOne.mockResolvedValue(null);
    Registration.countDocuments.mockResolvedValue(0);
    generateTicketNumber.mockReturnValue('EVT-TEST123');
    const mockReg = {
      _id: 'reg1',
      ticketNumber: 'EVT-TEST123',
      user: 'user1',
      event: validId,
    };
    Registration.create.mockResolvedValue(mockReg);
    const populatedReg = { ...mockReg, populate: jest.fn(function() { return this; }) };
    const mockQuery = {
      populate: jest.fn(function() { return populatedReg; }),
    };
    Registration.findById.mockReturnValue(mockQuery);
    const mockUser = { _id: 'user1', name: 'Test User', email: 'user@example.com', select: jest.fn().mockReturnThis() };
    User.findById.mockReturnValue(mockUser);
    mockedSendEmail.mockResolvedValue({ success: true, messageId: 'msg1' });

    const { req, res, next } = createReqResNext('user1');
    req.body = { eventId: validId };
    await registerForEvent(req, res, next);

    expect(Registration.create).toHaveBeenCalledWith({
      user: 'user1',
      event: validId,
      ticketNumber: 'EVT-TEST123',
    });
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'user1', name: 'Test User', email: 'user@example.com' }),
      mockEvent,
      expect.objectContaining({ _id: 'reg1' }),
      'http://localhost:3000'
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Successfully registered for the event.',
        emailSent: true,
      })
    );
  });

  it('re-creates cancelled registration and sends email', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    const mockEvent = { _id: validId, status: 'published', date: new Date(Date.now() + 86400000), title: 'Event' };
    Event.findById.mockReturnValue(mockEvent);
    const existingReg = {
      _id: 'reg1',
      status: 'cancelled',
      user: 'user1',
      event: validId,
      ticketNumber: 'OLD',
      registeredAt: new Date(),
      checkedIn: true,
      checkedInAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn(function() { return this; }),
    };
    Registration.findOne.mockResolvedValue(existingReg);
    const populatedReg = { ...existingReg, populate: jest.fn(function() { return this; }) };
    const mockQuery = {
      populate: jest.fn(function() { return populatedReg; }),
    };
    Registration.findById.mockReturnValue(mockQuery);
    const mockUser = { _id: 'user1', name: 'Test User', email: 'user@example.com', select: jest.fn().mockReturnThis() };
    User.findById.mockReturnValue(mockUser);
    generateTicketNumber.mockReturnValue('EVT-NEW123');
    mockedSendEmail.mockResolvedValue({ success: true, messageId: 'msg1' });

    const { req, res, next } = createReqResNext('user1');
    req.body = { eventId: validId };
    await registerForEvent(req, res, next);

    expect(existingReg.status).toBe('confirmed');
    expect(existingReg.ticketNumber).toBe('EVT-NEW123');
    expect(existingReg.registeredAt).not.toBeNull();
    expect(mockedSendEmail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
