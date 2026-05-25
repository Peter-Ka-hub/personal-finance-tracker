const express = require('express');
const router = express.Router();
const { getTransactions, addTransaction, deleteTransaction } = require('../controllers/transactionController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getTransactions);
router.post('/', addTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
