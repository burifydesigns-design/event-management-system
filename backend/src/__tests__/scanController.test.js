const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const TicketInstance = require('../models/TicketInstance');
const { scanTicket } = require('../controllers/scanController');

jest.mock('../models/Event');
jest.mock('../models/Registration');
jest.mock('../models/User');
jest.mock('../models/TicketInstance');

function createReqResNext(userId, role = 'organizer') {
  const req = {
    user: { userId, role },
    body: {},
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

function mockPopulate(value) {
  const populated = { ...value, populate: jest.fn(function() { return this; }) };
  const mockQuery = {
    ...value,
    populate: jest.fn(function() { return populated; }),
  };
  return mockQuery;
}

describe('scanTicket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TicketInstance.findOne.mockReset();
    TicketInstance.findOneAndUpdate.mockReset();
    Event.findById.mockReset();
    Registration.findOne.mockReset();
  });

  it('returns 400 when qrToken or eventId is missing', async () => {
    const { req, res, next } = createReqResNext('user1');
    req.body = { qrToken: 'token1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, message: 'QR token and event ID are required' });
  });

  it('returns 404 when ticket not found', async () => {
    TicketInstance.findOne.mockResolvedValue(null);
    const { req, res, next } = createReqResNext('user1');
    req.body = { qrToken: 'token1', eventId: 'event1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ valid: false, message: 'Ticket not found' });
  });

  it('returns 400 when ticket is for different event', async () => {
    TicketInstance.findOne.mockResolvedValue(mockPopulate({
      _id: 'ticket1',
      event: { _id: 'event2', title: 'Other', status: 'published', organizer: 'organizer1' },
      attendee: { _id: 'user1', name: 'Attendee', email: 'a@b.com' },
      status: 'valid',
    }));
    const { req, res, next } = createReqResNext('user1');
    req.body = { qrToken: 'token1', eventId: 'event1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, message: 'Ticket is for a different event' });
  });

  it('returns 400 when ticket is void', async () => {
    TicketInstance.findOne.mockResolvedValue(mockPopulate({
      _id: 'ticket1',
      event: { _id: 'event1', title: 'Event', status: 'published', organizer: 'organizer1' },
      attendee: { _id: 'user1', name: 'Attendee', email: 'a@b.com' },
      status: 'void',
    }));
    const { req, res, next } = createReqResNext('user1');
    req.body = { qrToken: 'token1', eventId: 'event1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, message: 'Ticket is void' });
  });

  it('returns 400 when ticket already used', async () => {
    TicketInstance.findOne.mockResolvedValue(mockPopulate({
      _id: 'ticket1',
      event: { _id: 'event1', title: 'Event', status: 'published', organizer: 'organizer1' },
      attendee: { _id: 'user1', name: 'Attendee', email: 'a@b.com' },
      status: 'used',
      scannedAt: new Date('2026-10-01T10:00:00Z'),
    }));
    const { req, res, next } = createReqResNext('user1');
    req.body = { qrToken: 'token1', eventId: 'event1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, message: 'Ticket already checked in', checkedInAt: expect.any(Date) });
  });

  it('returns 400 when event is cancelled', async () => {
    TicketInstance.findOne.mockResolvedValue(mockPopulate({
      _id: 'ticket1',
      event: { _id: 'event1', title: 'Event', status: 'cancelled', organizer: 'organizer1' },
      attendee: { _id: 'user1', name: 'Attendee', email: 'a@b.com' },
      status: 'valid',
    }));
    Registration.findOne.mockResolvedValue({ ticketNumber: 'EVT-1', status: 'confirmed' });
    const { req, res, next } = createReqResNext('user1');
    req.body = { qrToken: 'token1', eventId: 'event1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, message: 'Event has been cancelled' });
  });

  it('returns 400 when registration is cancelled', async () => {
    TicketInstance.findOne.mockResolvedValue(mockPopulate({
      _id: 'ticket1',
      event: { _id: 'event1', title: 'Event', status: 'published', organizer: 'organizer1' },
      attendee: { _id: 'user1', name: 'Attendee', email: 'a@b.com' },
      status: 'valid',
    }));
    Registration.findOne.mockResolvedValue(null);
    const { req, res, next } = createReqResNext('user1');
    req.body = { qrToken: 'token1', eventId: 'event1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, message: 'Registration not found or cancelled' });
  });

  it('returns 403 when organizer scans another organizers event', async () => {
    TicketInstance.findOne.mockResolvedValue(mockPopulate({
      _id: 'ticket1',
      event: { _id: 'event1', title: 'Event', status: 'published', organizer: 'organizer2' },
      attendee: { _id: 'user1', name: 'Attendee', email: 'a@b.com' },
      status: 'valid',
    }));
    Registration.findOne.mockResolvedValue({ ticketNumber: 'EVT-1', status: 'confirmed' });
    const { req, res, next } = createReqResNext('organizer1', 'organizer');
    req.body = { qrToken: 'token1', eventId: 'event1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ valid: false, message: 'Not authorized for this event' });
  });

  it('successfully checks in valid ticket', async () => {
    const mockUpdated = {
      _id: 'ticket1',
      status: 'used',
      scannedAt: new Date('2026-10-01T10:00:00Z'),
      scannedBy: 'user1',
    };
    TicketInstance.findOne.mockResolvedValue(mockPopulate({
      _id: 'ticket1',
      event: { _id: 'event1', title: 'Event', status: 'published', organizer: 'user1' },
      attendee: { _id: 'user1', name: 'Attendee', email: 'a@b.com' },
      status: 'valid',
    }));
    TicketInstance.findOneAndUpdate.mockResolvedValue(mockUpdated);
    Registration.findOne.mockResolvedValue({ ticketNumber: 'EVT-1', status: 'confirmed' });
    const { req, res, next } = createReqResNext('user1', 'attendee');
    req.body = { qrToken: 'token1', eventId: 'event1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        valid: true,
        message: 'Check-in successful',
        attendeeName: 'Attendee',
        ticketNumber: 'EVT-1',
      })
    );
    expect(TicketInstance.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'ticket1', status: 'valid' },
      { status: 'used', scannedAt: expect.any(Date), scannedBy: 'user1' },
      { new: true }
    );
  });

  it('returns already checked in when atomic update fails', async () => {
    TicketInstance.findOne.mockResolvedValue(mockPopulate({
      _id: 'ticket1',
      event: { _id: 'event1', title: 'Event', status: 'published', organizer: 'user1' },
      attendee: { _id: 'user1', name: 'Attendee', email: 'a@b.com' },
      status: 'valid',
    }));
    TicketInstance.findOneAndUpdate.mockResolvedValue(null);
    Registration.findOne.mockResolvedValue({ ticketNumber: 'EVT-1', status: 'confirmed' });
    const { req, res, next } = createReqResNext('user1', 'attendee');
    req.body = { qrToken: 'token1', eventId: 'event1' };
    await scanTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ valid: false, message: 'Ticket already checked in' });
  });
});
