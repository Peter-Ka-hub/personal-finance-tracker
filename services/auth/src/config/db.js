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
    schema: 'auth',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('[auth-service] Połączono z bazą danych PostgreSQL');
    await sequelize.createSchema('auth', { ifNotExists: true });
    await sequelize.sync({ alter: true });
    console.log('[auth-service] Tabele zsynchronizowane');
  } catch (error) {
    console.error('[auth-service] Błąd połączenia z bazą danych:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
