const crypto = require('crypto');

const generateTicketNumber = () => {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `EVT-${randomPart}`;
};

module.exports = generateTicketNumber;
