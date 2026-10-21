module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // mongodb-memory-server spawns a mongod per test file; running files
  // serially keeps memory usage and port contention predictable on CI/Windows.
  maxWorkers: 1,
  verbose: true,
};