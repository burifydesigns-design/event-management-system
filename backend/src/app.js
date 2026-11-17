const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const orderRoutes = require('./routes/orderRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const scanRoutes = require('./routes/scanRoutes');
const reportRoutes = require('./routes/reportRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const internalRoutes = require('./routes/internalRoutes');
const userRoutes = require('./routes/userRoutes');
const errorHandler = require('./middleware/errorHandler');
const { authRateLimit, checkoutRateLimit } = require('./middleware/rateLimit');
const connectDB = require('./config/db');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Frontend is hosted separately; API responses do not serve executable HTML.
}));

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// Exact-match allowlist only. Hostname patterns on *.vercel.app are NOT safe: anyone can create a
// Vercel project whose domain matches a pattern like "event-management-system-<anything>-<team>.vercel.app",
// and this API sends credentialed CORS headers. Add every frontend origin (production alias, custom
// domain, any stable preview alias) to FRONTEND_URL as a comma-separated list.
function isAllowedFrontendOrigin(origin) {
  return allowedOrigins.includes(origin);
}

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || isAllowedFrontendOrigin(origin)) return callback(null, true);
    // Log the rejected origin (bounded and JSON-encoded) so a missing legitimate origin is easy to spot.
    console.warn(JSON.stringify({ event: 'cors_rejected', origin: String(origin).slice(0, 200) }));
    const err = new Error('Origin is not allowed');
    err.status = 403;
    return callback(err);
  },
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Correlation IDs make distributed logs and support investigations traceable.
app.use((req, res, next) => {
  const supplied = req.headers['x-request-id'];
  req.requestId = typeof supplied === 'string' && /^[a-zA-Z0-9._-]{8,100}$/.test(supplied)
    ? supplied
    : require('crypto').randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', authRateLimit, registrationRoutes);
app.use('/api/admin', authRateLimit, adminRoutes);
app.use('/api/orders', checkoutRateLimit, orderRoutes);
app.use('/api/payments', checkoutRateLimit, paymentRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/tickets', authRateLimit, ticketRoutes);
app.use('/api/scan', authRateLimit, scanRoutes);
app.use('/api/reports', authRateLimit, reportRoutes);
app.use('/api/users', authRateLimit, userRoutes);
app.get('/', (_req, res) => res.send('Event Management API running with Supabase'));
app.get('/api/health', async (_req, res) => {
  try {
    const { getSupabase } = require('./config/db');
    const { error } = await getSupabase().from('events').select('id').limit(1);
    if (error) throw error;
    return res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    return res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);
connectDB().catch((err) => {
  console.error('Supabase startup check error:', err && err.message ? err.message : err);
});
module.exports = app;
