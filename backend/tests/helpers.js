const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock the email service so registration flows never touch SMTP in tests.
jest.mock('../src/services/emailService', () => ({
  sendRegistrationEmail: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Start an in-memory MongoDB, point the app at it, and load the Express app.
 * Must be called from beforeAll (async); returns the supertest-ready app.
 */
async function setupTestApp() {
  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.NODE_ENV = 'test';

  // Requiring the app triggers connectDB() with the memory server URI set above.
  const app = require('../src/app');
  await mongoose.connection.asPromise();

  return { app, mongoServer };
}

async function teardownTestApp(mongoServer) {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

function clearDatabase() {
  const collections = mongoose.connection.collections;
  return Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

/** Create a signed JWT matching authController.signToken's payload shape. */
function authToken(payload) {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

module.exports = {
  setupTestApp,
  teardownTestApp,
  clearDatabase,
  authToken,
};