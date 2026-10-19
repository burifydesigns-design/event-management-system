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
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ message: 'Event details are required' });
  }

  const fields = ['title', 'description', 'category', 'date', 'time', 'location', 'city', 'capacity'];
  for (const field of fields) {
    if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
      return res.status(400).json({ message: `${field} is required` });
    }
  }
  if (typeof req.body.title !== 'string' || !req.body.title.trim()
    || typeof req.body.description !== 'string' || !req.body.description.trim()
    || typeof req.body.category !== 'string' || !req.body.category.trim()
    || typeof req.body.location !== 'string' || !req.body.location.trim()
    || typeof req.body.city !== 'string' || !req.body.city.trim()) {
    return res.status(400).json({ message: 'Event text fields must not be empty' });
  }
  if (!Number.isInteger(Number(req.body.capacity)) || Number(req.body.capacity) < 1) {
    return res.status(400).json({ message: 'Capacity must be at least 1' });
  }
  if (req.body.price !== undefined && req.body.price !== null && req.body.price !== '') {
    if (!Number.isFinite(Number(req.body.price)) || Number(req.body.price) < 0) {
      return res.status(400).json({ message: 'Price must be a non-negative number' });
    }
  }
  if (Number.isNaN(new Date(req.body.date).getTime())) {
    return res.status(400).json({ message: 'Date must be valid' });
  }
  if (typeof req.body.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(req.body.time)) {
    return res.status(400).json({ message: 'Time must use HH:MM format' });
  }
  if (req.body.image !== undefined && typeof req.body.image !== 'string') {
    return res.status(400).json({ message: 'Image must be a string' });
  }
  if (req.body.image && req.body.image.trim()) {
    try {
      const imageUrl = new URL(req.body.image);
      if (!['http:', 'https:'].includes(imageUrl.protocol)) {
        return res.status(400).json({ message: 'Image URL must use HTTP or HTTPS' });
      }
    } catch (err) {
      return res.status(400).json({ message: 'Image URL must be valid' });
    }
  }
  if (req.body.status !== undefined && !['draft', 'published', 'cancelled'].includes(req.body.status)) {
    return res.status(400).json({ message: 'Invalid event status' });
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
