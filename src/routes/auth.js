const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  register, login, getMe, updateProfile, changePassword,
  forgotPassword, resetPassword, addAddress, deleteAddress,
  getWishlist, addToWishlist, removeFromWishlist,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

router.use(protect);
router.get('/me', getMe);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/addresses', addAddress);
router.delete('/addresses/:id', deleteAddress);

router.get('/wishlist', getWishlist);
router.post('/wishlist/:productId', addToWishlist);
router.delete('/wishlist/:productId', removeFromWishlist);

module.exports = router;
