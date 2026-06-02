const express = require('express');
const cors = require('cors');
const transactionRoutes = require('./routes/transactionRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/transactions', transactionRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'transactions' });
});

module.exports = app;
