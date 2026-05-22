const express = require('express');
const router = express.Router();
const { getCategories, addCategory, deleteCategory } = require('../controllers/categoryController');
const authMiddleware = require('../middleware/auth');

// Zabezpieczenie wszystkich endpointów w tym routerze
router.use(authMiddleware);

router.get('/', getCategories);
router.post('/', addCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
