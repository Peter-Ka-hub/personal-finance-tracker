require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const { syncModels } = require('./models');

const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Trasy API
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);

// Dodatkowa trasa testowa
app.get('/', (req, res) => {
  res.send('API serwera finansów działa poprawnie');
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await syncModels();
  
  app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
  });
};

startServer();
