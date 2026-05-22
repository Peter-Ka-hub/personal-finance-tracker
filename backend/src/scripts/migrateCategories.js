require('dotenv').config({ path: '../../.env' });
const { sequelize } = require('../config/db');
const { User, Category, Transaction } = require('../models');

const DEFAULT_CATEGORIES = [
  // Wydatki
  { name: 'Jedzenie', type: 'expense', color: '#EF4444', icon: 'pizza' },
  { name: 'Transport', type: 'expense', color: '#F59E0B', icon: 'car' },
  { name: 'Mieszkanie', type: 'expense', color: '#3B82F6', icon: 'home' },
  { name: 'Rozrywka', type: 'expense', color: '#8B5CF6', icon: 'film' },
  { name: 'Zdrowie', type: 'expense', color: '#10B981', icon: 'heart' },
  { name: 'Inne', type: 'expense', color: '#6B7280', icon: 'more-horizontal' },
  // Przychody
  { name: 'Wypłata', type: 'income', color: '#10B981', icon: 'dollar-sign' },
  { name: 'Premia', type: 'income', color: '#34D399', icon: 'award' },
  { name: 'Prezent', type: 'income', color: '#F472B6', icon: 'gift' },
  { name: 'Inne', type: 'income', color: '#6B7280', icon: 'more-horizontal' },
];

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Syncing models (alter: true) to ensure Category table and categoryId column exist...');
    await sequelize.sync({ alter: true });

    console.log('Fetching users...');
    const users = await User.findAll();
    console.log(`Found ${users.length} users.`);

    for (const user of users) {
      console.log(`Processing user: ${user.username} (${user.id})`);
      
      // Seed default categories
      for (const defCat of DEFAULT_CATEGORIES) {
        await Category.findOrCreate({
          where: { userId: user.id, name: defCat.name, type: defCat.type },
          defaults: {
            ...defCat,
            userId: user.id
          }
        });
      }

      // Fetch user's categories
      const userCategories = await Category.findAll({ where: { userId: user.id } });

      // Fetch user's transactions
      const transactions = await Transaction.findAll({ where: { userId: user.id } });
      console.log(`Found ${transactions.length} transactions for user ${user.username}.`);

      for (const tx of transactions) {
        if (tx.categoryId) {
          continue; // Already migrated
        }

        // Find matching category
        let category = userCategories.find(c => c.name === tx.category && c.type === tx.type);
        
        if (!category) {
          // If transaction has a category not in default, create it
          category = await Category.create({
            userId: user.id,
            name: tx.category,
            type: tx.type,
            color: '#9CA3AF', // default gray for unknown
            icon: 'circle'
          });
          userCategories.push(category);
          console.log(`Created custom category '${tx.category}' for user ${user.username}.`);
        }

        // Update transaction
        tx.categoryId = category.id;
        await tx.save();
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

runMigration();
