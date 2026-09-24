const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const TicketInstance = require('../models/TicketInstance');
const { getTicket } = require('../controllers/ticketController');

jest.mock('../models/Event');
jest.mock('../models/Registration');
jest.mock('../models/User');
jest.mock('../models/TicketInstance');

function createReqResNext(userId, role = 'attendee') {
  const req = {
    user: { userId, role },
    params: {},
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
    populate: jest.fn(function() { return populated; }),
  };
  return mockQuery;
}

describe('getTicket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TicketInstance.findById.mockReset();
    Registration.findOne.mockReset();
  });

  it('returns 404 when ticket not found', async () => {
    TicketInstance.findById.mockReturnValue(null);
    const { req, res, next } = createReqResNext('user1');
    req.params.ticketId = 'ticket1';
    await getTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ticket not found' });
  });

  it('returns 403 when another user accesses ticket', async () => {
    const ticket = {
      _id: 'ticket1',
      qrToken: 'token1',
      status: 'valid',
      event: { _id: 'event1', organizer: 'organizer1' },
      attendee: { _id: 'user2', name: 'Other', email: 'other@example.com' },
    };
    TicketInstance.findById.mockReturnValue(mockPopulate(ticket));
    const { req, res, next } = createReqResNext('user1');
    req.params.ticketId = 'ticket1';
    await getTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized' });
  });

  it('allows owner to access ticket', async () => {
    const ticket = {
      _id: 'ticket1',
      qrToken: 'token1',
      status: 'valid',
      event: { _id: 'event1', organizer: 'organizer1' },
      attendee: { _id: 'user1', name: 'Me', email: 'me@example.com' },
    };
    TicketInstance.findById.mockReturnValue(mockPopulate(ticket));
    Registration.findOne.mockResolvedValue({ ticketNumber: 'EVT-123', status: 'confirmed' });
    const { req, res, next } = createReqResNext('user1');
    req.params.ticketId = 'ticket1';
    await getTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket: expect.objectContaining({ qrToken: 'token1' }),
        registration: expect.objectContaining({ ticketNumber: 'EVT-123' }),
      })
    );
  });

  it('allows admin to access any ticket', async () => {
    const ticket = {
      _id: 'ticket1',
      qrToken: 'token1',
      status: 'valid',
      event: { _id: 'event1', organizer: 'organizer1' },
      attendee: { _id: 'user2', name: 'Other', email: 'other@example.com' },
    };
    TicketInstance.findById.mockReturnValue(mockPopulate(ticket));
    Registration.findOne.mockResolvedValue({ ticketNumber: 'EVT-123', status: 'confirmed' });
    const { req, res, next } = createReqResNext('admin1', 'admin');
    req.params.ticketId = 'ticket1';
    await getTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('allows organizer to access ticket for their event', async () => {
    const ticket = {
      _id: 'ticket1',
      qrToken: 'token1',
      status: 'valid',
      event: { _id: 'event1', organizer: 'organizer1' },
      attendee: { _id: 'user2', name: 'Other', email: 'other@example.com' },
    };
    TicketInstance.findById.mockReturnValue(mockPopulate(ticket));
    Registration.findOne.mockResolvedValue({ ticketNumber: 'EVT-123', status: 'confirmed' });
    const { req, res, next } = createReqResNext('organizer1', 'organizer');
    req.params.ticketId = 'ticket1';
    await getTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('denies organizer access to ticket for another event', async () => {
    const ticket = {
      _id: 'ticket1',
      qrToken: 'token1',
      status: 'valid',
      event: { _id: 'event1', organizer: 'organizer2' },
      attendee: { _id: 'user2', name: 'Other', email: 'other@example.com' },
    };
    TicketInstance.findById.mockReturnValue(mockPopulate(ticket));
    const { req, res, next } = createReqResNext('organizer1', 'organizer');
    req.params.ticketId = 'ticket1';
    await getTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized' });
  });
});
