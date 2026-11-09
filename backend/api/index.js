// Vercel serverless entry point. Vercel calls the exported Express app for every request;
// backend/vercel.json rewrites all paths here so routes keep their /api/... prefix.
module.exports = require('../src/app');
