function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateRegister(req, res, next) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  next();
}

function validateEvent(req, res, next) {
  const fields = ['title', 'description', 'category', 'date', 'time', 'location', 'city', 'capacity', 'price'];
  for (const field of fields) {
    if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
      return res.status(400).json({ message: `${field} is required` });
    }
  }
  if (req.body.capacity < 1) {
    return res.status(400).json({ message: 'Capacity must be at least 1' });
  }
  if (req.body.price < 0) {
    return res.status(400).json({ message: 'Price cannot be negative' });
  }
  next();
}

function validateRegistration(req, res, next) {
  const { eventId } = req.body;
  if (!eventId) {
    return res.status(400).json({ message: 'Event ID is required' });
  }
  next();
}

module.exports = {
  validateEmail,
  validateRegister,
  validateLogin,
  validateEvent,
  validateRegistration,
};
