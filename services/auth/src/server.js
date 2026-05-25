require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth' });
});

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[auth-service] Serwer działa na porcie ${PORT}`);
  });
};

startServer();
