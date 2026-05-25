require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const categoryRoutes = require('./routes/categoryRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/categories', categoryRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'categories' });
});

const PORT = process.env.PORT || 3002;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[category-service] Serwer działa na porcie ${PORT}`);
  });
};

startServer();
