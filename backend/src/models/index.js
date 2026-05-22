const { sequelize } = require('../config/db');
const User = require('./User');
const Transaction = require('./Transaction');
const Category = require('./Category');

// Zdefiniowanie relacji
User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Category, { foreignKey: 'userId', as: 'categories' });
Category.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Category.hasMany(Transaction, { foreignKey: 'categoryId', as: 'transactions' });
Transaction.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// Opcjonalnie: funkcja synchronizująca tabele
const syncModels = async () => {
  try {
    await sequelize.sync({ alter: true }); // Uaktualnia schemat bazy bez utraty danych (tylko w dev!)
    console.log('Modele zsynchronizowane z bazą danych.');
  } catch (error) {
    console.error('Błąd synchronizacji modeli:', error);
  }
};

module.exports = { User, Transaction, Category, syncModels };
