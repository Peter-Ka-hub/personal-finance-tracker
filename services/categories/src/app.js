const express = require('express');
const cors = require('cors');
const categoryRoutes = require('./routes/categoryRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/categories', categoryRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'categories' });
});

module.exports = app;
