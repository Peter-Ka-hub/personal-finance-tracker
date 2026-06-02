const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const http = require('http');
const User = require('../models/User');

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

const seedCategories = async (userId) => {
  const categoriesUrl = process.env.CATEGORIES_SERVICE_URL;
  if (!categoriesUrl) {
    console.warn('[auth-service] CATEGORIES_SERVICE_URL not set — skipping category seed');
    return;
  }

  const body = JSON.stringify({ userId, categories: DEFAULT_CATEGORIES });
  const url = new URL(`${categoriesUrl}/api/categories/seed`);
  const transport = url.protocol === 'https:' ? https : http;

  await new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Internal-Key': process.env.INTERNAL_API_KEY || '',
        },
        // Azure Container Apps' internal ingress uses a platform-managed cert
        // that isn't in Node's trust store; skip verification for this internal
        // service-to-service call (traffic stays inside the environment).
        rejectUnauthorized: false,
      },
      (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`categories seed returned ${res.statusCode}`));
        }
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
    const newUser = await User.create({ username, password: hashedPassword });

    await seedCategories(newUser.id);

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
