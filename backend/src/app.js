const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const trainingRoutes = require('./routes/trainings');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const roomRoutes = require('./routes/rooms');
const historyRoutes = require('./routes/history');
const adminRoutes = require('./routes/admin');
const { router: legalRoutes } = require('./routes/legal');
const notificationRoutes = require('./routes/notifications');
const trainerFinanceRoutes = require('./routes/trainerFinance');

const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/trainer', trainerFinanceRoutes);

app.use(errorHandler);

module.exports = app;
