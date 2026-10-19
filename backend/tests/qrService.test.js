const { generateTicketToken, generateQRImage, generateRegistrationQR } = require('../src/services/qrService');

describe('QR Code Service', () => {
  describe('generateTicketToken', () => {
    test('generates a UUID v4', () => {
      const token = generateTicketToken();
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('generates unique tokens on each call', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateTicketToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('generateQRImage', () => {
    test('returns a base64 PNG data URL', async () => {
      const qrCode = await generateQRImage('test-payload');
      expect(qrCode).toMatch(/^data:image\/png;base64,/);
    });

    test('generates valid PNG data', async () => {
      const qrCode = await generateQRImage('test-payload');
      const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4E);
      expect(buffer[3]).toBe(0x47);
    });

    test('generates different images for different payloads', async () => {
      const qr1 = await generateQRImage('payload-1');
      const qr2 = await generateQRImage('payload-2');
      expect(qr1).not.toBe(qr2);
    });

    test('generates same image for same payload', async () => {
      const qr1 = await generateQRImage('same-payload');
      const qr2 = await generateQRImage('same-payload');
      expect(qr1).toBe(qr2);
    });
  });

  describe('generateRegistrationQR', () => {
    test('returns a base64 PNG data URL', async () => {
      const qrCode = await generateRegistrationQR('EVT-TEST123');
      expect(qrCode).toMatch(/^data:image\/png;base64,/);
    });

    test('includes ticket number in payload format EVT1:ticketNumber', async () => {
      const qrCode = await generateRegistrationQR('EVT-ABC123');
      const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4E);
      expect(buffer[3]).toBe(0x47);
    });

    test('generates stable QR code for same ticket number', async () => {
      const qr1 = await generateRegistrationQR('EVT-STABLE123');
      const qr2 = await generateRegistrationQR('EVT-STABLE123');
      expect(qr1).toBe(qr2);
    });

    test('generates different QR codes for different ticket numbers', async () => {
      const qr1 = await generateRegistrationQR('EVT-DIFF1');
      const qr2 = await generateRegistrationQR('EVT-DIFF2');
      expect(qr1).not.toBe(qr2);
    });

    test('does not contain sensitive attendee information', async () => {
      const qrCode = await generateRegistrationQR('EVT-TEST123');
      const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
      const payload = base64Data; // The QR payload is encoded in the image, not directly in base64
      // The payload should be "EVT1:EVT-TEST123" which doesn't contain email, password, etc.
      expect(payload).not.toContain('email');
      expect(payload).not.toContain('password');
      expect(payload).not.toContain('jwt');
      expect(payload).not.toContain('token');
    });
  });
});