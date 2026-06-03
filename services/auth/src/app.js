const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Behind the Nginx gateway: trust the first proxy hop so rate limiting and
// logging see the real client IP (from X-Forwarded-For), not the proxy's.
app.set('trust proxy', 1);

app.use(helmet());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

const corsOptions = process.env.CORS_ORIGIN
  ? { origin: process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) }
  : {};
app.use(cors(corsOptions));
app.use(express.json());

// Throttle auth endpoints to slow down brute-force / credential-stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.' },
});

app.use('/api/auth', authLimiter, authRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth' });
});

// 404 + centralized error handler
app.use((req, res) => res.status(404).json({ message: 'Nie znaleziono' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[auth-service] Nieobsłużony błąd:', err);
  res.status(500).json({ message: 'Błąd serwera' });
});

module.exports = app;
