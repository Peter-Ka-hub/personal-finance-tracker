const express = require('express');
const router = express.Router();
const { getCategories, addCategory, deleteCategory, seedCategories } = require('../controllers/categoryController');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { categorySchema } = require('../validators');

// Internal endpoint — no JWT, protected by INTERNAL_API_KEY header
router.post('/seed', seedCategories);

router.use(authMiddleware);

router.get('/', getCategories);
router.post('/', validate(categorySchema), addCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
