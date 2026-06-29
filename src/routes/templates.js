const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate } = require('../controllers/templateController');

// Public
router.get('/', getTemplates);
router.get('/:id', getTemplate);

// Admin only
router.use(protect, adminOnly);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

module.exports = router;
