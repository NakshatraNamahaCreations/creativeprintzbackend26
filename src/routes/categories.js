const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getCategories, getCategory, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');

router.get('/', getCategories);
router.get('/:slug', getCategory);

router.use(protect, adminOnly);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;
