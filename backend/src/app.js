const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const scanRoutes = require('./routes/scanRoutes');
const orderRoutes = require('./routes/orderRoutes');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/db');

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/orders', orderRoutes);

app.get('/', (req, res) => res.send('Event Management API running'));

app.use(errorHandler);

module.exports = app;
