const { scanTicket } = require('../src/controllers/scanController');
const Registration = require('../src/models/Registration');

describe('Scan controller', () => {
  let organizer;
  let attendee;
  let event;

  beforeEach(async () => {
    organizer = await global.testUtils.createUser({
      name: 'Organizer',
      email: 'scan-organizer@example.com',
      role: 'organizer',
    });
    attendee = await global.testUtils.createUser({
      name: 'Attendee',
      email: 'scan-attendee@example.com',
    });
    event = await global.testUtils.createEvent({
      organizer: organizer._id,
      date: new Date(Date.now() - 2 * 60 * 60 * 1000),
      time: '12:00',
    });
  });

  test('allows an organizer to check in a valid ticket for their event', async () => {
    const registration = await global.testUtils.createRegistration({
      user: attendee._id,
      event: event._id,
      ticketNumber: 'EVT-VALID123',
      status: 'confirmed',
    });

    const req = {
      body: { qrCode: `EVT1:${registration.ticketNumber}`, eventId: event._id.toString() },
      user: { userId: organizer._id.toString(), _id: organizer._id, role: 'organizer' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await scanTicket(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ valid: true, ticketNumber: registration.ticketNumber }));

    const updated = await Registration.findById(registration._id);
    expect(updated.checkedIn).toBe(true);
    expect(updated.status).toBe('checked-in');
    expect(updated.checkedInBy.toString()).toBe(organizer._id.toString());
  });

  test('rejects a ticket for a different event', async () => {
    const otherEvent = await global.testUtils.createEvent({
      organizer: organizer._id,
      title: 'Other Event',
      date: new Date(Date.now() - 30 * 60 * 1000),
      time: '13:00',
    });
    const registration = await global.testUtils.createRegistration({
      user: attendee._id,
      event: otherEvent._id,
      ticketNumber: 'EVT-DIFF456',
      status: 'confirmed',
    });

    const req = {
      body: { qrCode: `EVT1:${registration.ticketNumber}`, eventId: event._id.toString() },
      user: { userId: organizer._id.toString(), _id: organizer._id, role: 'organizer' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await scanTicket(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ valid: false, message: 'Ticket belongs to a different event' }));
  });

  test('rejects attendee users from checking themselves in', async () => {
    const registration = await global.testUtils.createRegistration({
      user: attendee._id,
      event: event._id,
      ticketNumber: 'EVT-SELF789',
      status: 'confirmed',
    });

    const req = {
      body: { qrCode: `EVT1:${registration.ticketNumber}`, eventId: event._id.toString() },
      user: { userId: attendee._id.toString(), _id: attendee._id, role: 'attendee' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await scanTicket(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ valid: false, message: 'Unauthorized staff member' }));
  });

  test('rejects ticket check-in after an event has been cancelled', async () => {
    const registration = await global.testUtils.createRegistration({
      user: attendee._id,
      event: event._id,
      ticketNumber: 'EVT-CANCELLED123',
      status: 'confirmed',
    });
    event.status = 'cancelled';
    await event.save();

    const req = {
      body: { qrCode: `EVT1:${registration.ticketNumber}`, eventId: event._id.toString() },
      user: { userId: organizer._id.toString(), _id: organizer._id, role: 'organizer' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await scanTicket(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ valid: false, message: 'Event has been cancelled' }));
    expect((await Registration.findById(registration._id)).checkedIn).toBe(false);
  });
});
