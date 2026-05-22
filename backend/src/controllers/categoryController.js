const { Category } = require('../models');

const getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'ASC']]
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error('Błąd pobierania kategorii:', error);
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
    console.error('Błąd dodawania kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await Category.findOne({ where: { id, userId: req.user.id } });
    if (!category) {
      return res.status(404).json({ message: 'Kategoria nie znaleziona lub brak dostępu' });
    }

    await category.destroy();
    res.status(200).json({ message: 'Kategoria usunięta', id });
  } catch (error) {
    console.error('Błąd usuwania kategorii:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

module.exports = { getCategories, addCategory, deleteCategory };
