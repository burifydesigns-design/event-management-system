const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { setTestTransporter, clearTestTransporter } = require('../src/services/emailService');
const nodemailer = require('nodemailer');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  const testTransport = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
  testTransport.on('message', (message) => {
    if (!global.sentEmails) global.sentEmails = [];
    global.sentEmails.push(message);
  });
  setTestTransporter(testTransport);
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  clearTestTransporter();
}, 30000);

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
  global.sentEmails = [];
}, 10000);

global.testUtils = {
  createUser: async (data = {}) => {
    const User = require('../src/models/User');
    const bcrypt = require('bcryptjs');
    const password = data.password || 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);
    return User.create({
      name: data.name || 'Test User',
      email: data.email || `test${Date.now()}@example.com`,
      password: hashedPassword,
      role: data.role || 'attendee',
    });
  },
  createEvent: async (data = {}) => {
    const Event = require('../src/models/Event');
    return Event.create({
      title: data.title || 'Test Event',
      description: data.description || 'Test Description',
      category: data.category || 'Workshop',
      date: data.date || new Date(Date.now() + 86400000),
      time: data.time || '10:00',
      location: data.location || 'Test Location',
      city: data.city || 'Test City',
      capacity: data.capacity || 100,
      price: data.price || 0,
      organizer: data.organizer,
      status: data.status || 'published',
    });
  },
  createRegistration: async (data = {}) => {
    const Registration = require('../src/models/Registration');
    return Registration.create({
      user: data.user,
      event: data.event,
      ticketNumber: data.ticketNumber || `EVT-TEST${Date.now()}`,
      status: data.status || 'confirmed',
    });
  },
  getAuthToken: (user) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId: user._id.toString(), role: user.role, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  },
};