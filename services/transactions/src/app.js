const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const transactionRoutes = require('./routes/transactionRoutes');

const app = express();

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

app.use('/api/transactions', transactionRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'transactions' });
});

app.use((req, res) => res.status(404).json({ message: 'Nie znaleziono' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[transaction-service] Nieobsłużony błąd:', err);
  res.status(500).json({ message: 'Błąd serwera' });
});

module.exports = app;
