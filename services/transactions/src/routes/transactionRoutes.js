const express = require('express');
const router = express.Router();
const { getTransactions, addTransaction, deleteTransaction } = require('../controllers/transactionController');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { transactionSchema } = require('../validators');

router.use(authMiddleware);

router.get('/', getTransactions);
router.post('/', validate(transactionSchema), addTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
