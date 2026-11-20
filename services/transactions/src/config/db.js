require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    schema: 'transactions',
    dialectOptions: process.env.DB_SSL === 'true' ? {
      ssl: { host: process.env.DB_HOST, rejectUnauthorized: true }
    } : {},
    logging: false
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('[transaction-service] Połączono z bazą danych PostgreSQL');
  } catch (error) {
    console.error('[transaction-service] Błąd połączenia z bazą danych:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
