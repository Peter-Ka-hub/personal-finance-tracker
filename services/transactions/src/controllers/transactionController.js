const { QueryTypes, Transaction: DbTransaction } = require('sequelize');
const { sequelize } = require('../config/db');
const Transaction = require('../models/Transaction');

const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { userId: req.user.id },
      order: [['date', 'DESC'], ['createdAt', 'DESC']]
    });
    res.status(200).json(transactions);
  } catch (error) {
    console.error('[transaction-service] Błąd pobierania transakcji:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

const addTransaction = async (req, res) => {
  const { type, amount, categoryId, description, date } = req.body;
  const userId = req.user.id;

  try {
    const newTransaction = await sequelize.transaction({
      isolationLevel: DbTransaction.ISOLATION_LEVELS.READ_COMMITTED,
    }, async (transaction) => {
      // This row lock conflicts with the archive UPDATE until the insert commits.
      const [category] = await sequelize.query(`
        SELECT id FROM categories."Categories"
        WHERE id = $categoryId AND "userId" = $userId AND type = $type
          AND "archivedAt" IS NULL
        FOR SHARE
      `, {
        bind: { categoryId, userId, type },
        type: QueryTypes.SELECT,
        transaction,
      });

      if (!category) return null;

      return Transaction.create({ userId, type, amount, categoryId, description, date }, { transaction });
    });

    if (!newTransaction) {
      return res.status(400).json({ message: 'Kategoria jest niedostępna dla tej transakcji' });
    }
    res.status(201).json(newTransaction);
  } catch (error) {
    console.error('[transaction-service] Błąd dodawania transakcji:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

const deleteTransaction = async (req, res) => {
  const { id } = req.params;

  try {
    const transaction = await Transaction.findOne({ where: { id, userId: req.user.id } });
    if (!transaction) {
      return res.status(404).json({ message: 'Transakcja nie znaleziona lub brak dostępu' });
    }

    await transaction.destroy();
    res.status(200).json({ message: 'Transakcja usunięta', id });
  } catch (error) {
    console.error('[transaction-service] Błąd usuwania transakcji:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
};

module.exports = { getTransactions, addTransaction, deleteTransaction };
