const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { seedCategories } = require('../clients/categories');
const User = require('../models/User');
const PendingCategorySeed = require('../models/PendingCategorySeed');
const { sequelize } = require('../config/db');

const DEFAULT_CATEGORIES = [
  { name: 'Jedzenie', type: 'expense', color: '#EF4444', icon: 'pizza' },
  { name: 'Transport', type: 'expense', color: '#F59E0B', icon: 'car' },
  { name: 'Mieszkanie', type: 'expense', color: '#3B82F6', icon: 'home' },
  { name: 'Rozrywka', type: 'expense', color: '#8B5CF6', icon: 'film' },
  { name: 'Zdrowie', type: 'expense', color: '#10B981', icon: 'heart' },
  { name: 'Inne wydatki', type: 'expense', color: '#6B7280', icon: 'more-horizontal' },
  { name: 'Wypłata', type: 'income', color: '#10B981', icon: 'dollar-sign' },
  { name: 'Premia', type: 'income', color: '#34D399', icon: 'award' },
  { name: 'Prezent', type: 'income', color: '#F472B6', icon: 'gift' },
  { name: 'Inne przychody', type: 'income', color: '#6B7280', icon: 'more-horizontal' },
];

const completeCategorySeed = async (userId) => {
  if (!process.env.CATEGORIES_SERVICE_URL) {
    return;
  }

  try {
    if (await PendingCategorySeed.findByPk(userId)) {
      await seedCategories(userId, DEFAULT_CATEGORIES);
      await PendingCategorySeed.destroy({ where: { userId } });
    }
  } catch (error) {
    console.warn('[auth-service] Inicjalizacja kategorii oczekuje na ponowienie:', error.message);
  }
};

const register = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Proszę podać nazwę użytkownika i hasło' });
  }

  try {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'Użytkownik o takiej nazwie już istnieje' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await sequelize.transaction(async (transaction) => {
      const user = await User.create({ username, password: hashedPassword }, { transaction });
      await PendingCategorySeed.create({ userId: user.id }, { transaction });
      return user;
    });

    await completeCategorySeed(newUser.id);

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, username: newUser.username });
  } catch (error) {
    console.error('[auth-service] Błąd rejestracji:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Proszę podać nazwę użytkownika i hasło' });
  }

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(400).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    await completeCategorySeed(user.id);

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({ token, username: user.username });
  } catch (error) {
    console.error('[auth-service] Błąd logowania:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

module.exports = { register, login };
