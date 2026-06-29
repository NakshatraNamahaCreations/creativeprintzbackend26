const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  createOrder, createPaymentOrder, verifyPayment,
  getMyOrders, getOrder, getAllOrders, updateOrderStatus,
} = require('../controllers/orderController');

router.use(protect);
router.post('/', createOrder);
router.post('/:id/payment', createPaymentOrder);
router.post('/verify-payment', verifyPayment);
router.get('/my-orders', getMyOrders);
router.get('/:id', getOrder);

router.use(adminOnly);
router.get('/', getAllOrders);
router.put('/:id/status', updateOrderStatus);

module.exports = router;
