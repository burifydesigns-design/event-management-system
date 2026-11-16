const { normalizeKenyanPhone } = require('./paymentService');

describe('normalizeKenyanPhone', () => {
  test.each([
    ['0712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['712345678', '254712345678'],
    ['254712345678', '254712345678'],
    ['+254 712 345 678', '254712345678'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  test.each(['12345', '0201234567', '254201234567', '', null])('rejects invalid phone %s', (input) => {
    expect(() => normalizeKenyanPhone(input)).toThrow('valid Kenyan mobile number');
  });
});
