const mongoose = require('mongoose');
const validator = require('validator');

function validateEmailFormat(email) {
  if (typeof email !== 'string') return false;
  return validator.isEmail(email);
}

function isValidObjectId(id) {
  if (typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

function validateRegister(req, res, next) {
  const { name, email, password } = req.body;
  if (!name || typeof name !== 'string' || !email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }
  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (trimmedName.length === 0 || trimmedName.length > 100) {
    return res.status(400).json({ message: 'Invalid name' });
  }
  if (!validateEmailFormat(normalizedEmail)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  req.body.name = trimmedName;
  req.body.email = normalizedEmail;
  delete req.body.role;
  delete req.body._id;
  delete req.body.isAdmin;
  delete req.body.permissions;
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!validateEmailFormat(normalizedEmail)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  req.body.email = normalizedEmail;
  delete req.body.role;
  delete req.body._id;
  next();
}

function validateEvent(req, res, next) {
  const fields = ['title', 'category', 'date', 'time', 'location', 'city', 'capacity', 'price'];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
      return res.status(400).json({ message: field + ' is required' });
    }
  }
  if (typeof req.body.title === 'string') {
    const t = req.body.title.trim();
    if (t.length === 0 || t.length > 200) return res.status(400).json({ message: 'Invalid title' });
    req.body.title = t;
  }
  if (typeof req.body.description === 'string') {
    req.body.description = req.body.description.trim();
    if (req.body.description.length === 0 || req.body.description.length > 5000) {
      return res.status(400).json({ message: 'Invalid description' });
    }
  }
  if (typeof req.body.category === 'string') req.body.category = req.body.category.trim();
  if (typeof req.body.location === 'string') req.body.location = req.body.location.trim();
  if (typeof req.body.city === 'string') req.body.city = req.body.city.trim();
  if (typeof req.body.time === 'string') req.body.time = req.body.time.trim();

  const capacity = Number(req.body.capacity);
  const price = Number(req.body.price);
  if (isNaN(capacity) || !Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
    return res.status(400).json({ message: 'Capacity must be at least 1' });
  }
  if (isNaN(price) || price < 0 || price > 1000000) {
    return res.status(400).json({ message: 'Price cannot be negative' });
  }
  req.body.capacity = capacity;
  req.body.price = price;

  const eventDate = new Date(req.body.date);
  if (isNaN(eventDate.getTime())) {
    return res.status(400).json({ message: 'Invalid date' });
  }
  req.body.date = eventDate;

  delete req.body.organizer;
  delete req.body.status;
  delete req.body._id;
  delete req.body.createdAt;
  delete req.body.updatedAt;
  next();
}

function validateEventUpdate(req, res, next) {
  const protected = ['organizer', 'status', '_id', 'createdAt', 'updatedAt', '__v'];
  for (let i = 0; i < protected.length; i++) {
    const fieldName = protected[i];
    if (fieldName in req.body) delete req.body[fieldName];
  }
  if (req.body.capacity !== undefined) {
    const capacity = Number(req.body.capacity);
    if (isNaN(capacity) || !Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
      return res.status(400).json({ message: 'Capacity must be at least 1' });
    }
    req.body.capacity = capacity;
  }
  if (req.body.price !== undefined) {
    const price = Number(req.body.price);
    if (isNaN(price) || price < 0 || price > 1000000) {
      return res.status(400).json({ message: 'Price cannot be negative' });
    }
    req.body.price = price;
  }
  if (req.body.date !== undefined) {
    const eventDate = new Date(req.body.date);
    if (isNaN(eventDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }
    req.body.date = eventDate;
  }
  if (typeof req.body.title === 'string') {
    req.body.title = req.body.title.trim();
    if (req.body.title.length === 0 || req.body.title.length > 200) return res.status(400).json({ message: 'Invalid title' });
  }
  if (typeof req.body.description === 'string') {
    req.body.description = req.body.description.trim();
    if (req.body.description.length === 0 || req.body.description.length > 5000) {
      return res.status(400).json({ message: 'Invalid description' });
    }
  }
  if (typeof req.body.location === 'string') req.body.location = req.body.location.trim();
  if (typeof req.body.city === 'string') req.body.city = req.body.city.trim();
  if (typeof req.body.time === 'string') req.body.time = req.body.time.trim();
  if (typeof req.body.category === 'string') req.body.category = req.body.category.trim();
  next();
}

function validateRegistration(req, res, next) {
  const { eventId } = req.body;
  if (!eventId) {
    return res.status(400).json({ message: 'Event ID is required' });
  }
  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'Invalid event ID' });
  }
  delete req.body.user;
  delete req.body.status;
  delete req.body.ticketNumber;
  delete req.body.checkedIn;
  next();
}

function validateObjectIdParam(paramName) {
  if (!paramName) paramName = 'id';
  return function (req, res, next) {
    const id = req.params[paramName];
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }
    next();
  };
}

function validatePaginationQuery(req, res, next) {
  if (req.query.page !== undefined) {
    const page = Number(req.query.page);
    if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
      return res.status(400).json({ message: 'Invalid page' });
    }
    req.query.page = page;
  }
  if (req.query.limit !== undefined) {
    const limit = Number(req.query.limit);
    if (isNaN(limit) || limit < 1 || limit > 100 || !Number.isInteger(limit)) {
      return res.status(400).json({ message: 'Invalid limit' });
    }
    req.query.limit = limit;
  }
  if (req.query.sortBy !== undefined) {
    const allowed = ['date', 'createdAt', 'title', 'price', 'capacity'];
    if (allowed.indexOf(req.query.sortBy) === -1) {
      return res.status(400).json({ message: 'Invalid sort field' });
    }
  }
  if (req.query.order !== undefined && req.query.order !== 'asc' && req.query.order !== 'desc') {
    return res.status(400).json({ message: 'Invalid sort order' });
  }
  next();
}

module.exports = {
  validateEmailFormat,
  validateEmail: validateEmailFormat,
  validateRegister,
  validateLogin,
  validateEvent,
  validateEventUpdate,
  validateRegistration,
  validateObjectIdParam,
  validatePaginationQuery,
  isValidObjectId,
};
