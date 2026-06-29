const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, uploadProductImages, addReview,
} = require('../controllers/productController');

router.get('/', getProducts);
router.get('/:slug', getProduct);
router.post('/:id/reviews', protect, addReview);

router.use(protect, adminOnly);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/upload/images', upload.array('images', 10), uploadProductImages);

module.exports = router;
