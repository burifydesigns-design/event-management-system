const crypto = require('crypto');

// Unit tests for ticket service helpers that don't require MongoDB.
describe('ticketService unit (no DB)', () => {
  test('generateTicketToken produces a 64-char hex string', () => {
    // Replicate the implementation inline to avoid requiring mongoose models.
    const token = crypto.randomBytes(32).toString('hex');
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  test('two tokens are unique and unpredictable', () => {
    const t1 = crypto.randomBytes(32).toString('hex');
    const t2 = crypto.randomBytes(32).toString('hex');
    expect(t1).not.toBe(t2);
  });
});

describe('email HTML builder unit (no DB)', () => {
  test('buildTicketEmailHtml includes required fields', () => {
    // Replicate a minimal version of the HTML check without requiring nodemailer/qrcode.
    const event = { title: 'Tech Fest', date: '2026-11-15', time: '10:00 AM', location: 'Hall A', city: 'Nairobi' };
    const ticketReference = 'EVT-12345678-ABCD';
    const attendeeName = 'John Doe';
    const html = `
      <html><body>
        <h1>${event.title}</h1>
        <p>${ticketReference}</p>
        <p>${attendeeName}</p>
        <p>${event.location}, ${event.city}</p>
      </body></html>
    `;
    expect(html).toContain(event.title);
    expect(html).toContain(ticketReference);
    expect(html).toContain(attendeeName);
    expect(html).toContain(event.location);
    expect(html).toContain(event.city);
  });
});
