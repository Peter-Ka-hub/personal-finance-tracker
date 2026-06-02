require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 3002;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[category-service] Serwer działa na porcie ${PORT}`);
  });
};

startServer();
