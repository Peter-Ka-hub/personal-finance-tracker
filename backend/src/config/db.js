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
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Wymagane dla Azure PostgreSQL w środowiskach deweloperskich
      }
    },
    logging: false
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Połączono z bazą danych PostgreSQL (Azure)');
  } catch (error) {
    console.error('Błąd połączenia z bazą danych:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
