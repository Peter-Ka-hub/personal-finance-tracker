const Category = require('../models/Category');
const CategorySeed = require('../models/CategorySeed');
const { sequelize } = require('../config/db');

const getCategories = async (req, res) => {
  const where = { userId: req.user.id };
  if (req.query.includeArchived !== 'true') {
    where.archivedAt = null;
  }
  try {
    const categories = await Category.findAll({
      where,
      order: [['createdAt', 'ASC']]
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error('[category-service] Błąd pobierania kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

const addCategory = async (req, res) => {
  const { name, type, color, icon } = req.body;
  if (!name || !type) {
    return res.status(400).json({ message: 'Nazwa i typ kategorii są wymagane' });
  }

  try {
    const newCategory = await Category.create({
      userId: req.user.id,
      name,
      type,
      color,
      icon
    });
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('[category-service] Błąd dodawania kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const [updatedCount] = await Category.update({ archivedAt: new Date() }, {
      where: { id, userId: req.user.id, archivedAt: null }
    });
    if (updatedCount === 0) {
      return res.status(404).json({ message: 'Kategoria nie znaleziona lub brak dostępu' });
    }

    res.status(200).json({ message: 'Kategoria zarchiwizowana', id });
  } catch (error) {
    console.error('[category-service] Błąd archiwizacji kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

const seedCategories = async (req, res) => {
  const internalKey = req.headers['x-internal-key'];
  if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { userId, categories } = req.body;
  if (!userId || !Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ message: 'userId i categories są wymagane' });
  }

  try {
    const created = await sequelize.transaction(async (transaction) => {
      // Sequelize findOrCreate can create a temporary PostgreSQL function.
      const table = sequelize.getQueryInterface().queryGenerator.quoteTable(CategorySeed.getTableName());
      const [inserted] = await sequelize.query(`
        INSERT INTO ${table} ("userId") VALUES ($userId)
        ON CONFLICT ("userId") DO NOTHING RETURNING "userId"
      `, { bind: { userId }, transaction });
      const firstSeed = inserted.length > 0;
      if (firstSeed) {
        const rows = categories.map(cat => ({ ...cat, userId }));
        await Category.bulkCreate(rows, { transaction, validate: true });
      }
      return firstSeed;
    });
    res.status(created ? 201 : 200).json({
      message: created ? 'Kategorie domyślne utworzone' : 'Kategorie zostały już zainicjalizowane',
    });
  } catch (error) {
    console.error('[category-service] Błąd seedowania kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

module.exports = { getCategories, addCategory, deleteCategory, seedCategories };
