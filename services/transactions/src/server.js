require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const transactionRoutes = require('./routes/transactionRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/transactions', transactionRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'transactions' });
});

const PORT = process.env.PORT || 3003;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[transaction-service] Serwer działa na porcie ${PORT}`);
  });
};

startServer();
