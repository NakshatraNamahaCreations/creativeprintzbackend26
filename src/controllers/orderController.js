const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'your_razorpay_key_id') {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn('Razorpay keys missing or default. Payment features will be disabled.');
}

// @desc    Create order
exports.createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, notes, clientItems } = req.body;

    let orderItems, itemsPrice, discountAmount = 0, coupon = null;

    // Try MongoDB cart first
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

    if (cart && cart.items.length > 0) {
      itemsPrice = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      discountAmount = cart.discountAmount || 0;
      coupon = cart.coupon;
      orderItems = cart.items.map((item) => ({
        product: item.product._id,
        name: item.product.name,
        image: item.product.images[0]?.url,
        quantity: item.quantity,
        price: item.price,
        selectedSize: item.selectedSize,
        selectedMaterial: item.selectedMaterial,
        selectedFinish: item.selectedFinish,
        selectedQuantity: item.selectedQuantity,
        customDesign: item.customDesign,
      }));
    } else if (clientItems && clientItems.length > 0) {
      // Fallback: use cart items sent from the client (local/offline cart)
      itemsPrice = clientItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      orderItems = clientItems.map((item) => ({
        product: item.productId,
        name: item.name,
        image: item.image,
        quantity: item.quantity,
        price: item.price,
      }));
    } else {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const shippingPrice = itemsPrice > 999 ? 0 : 99;
    const taxPrice = Math.round(itemsPrice * 0.18);
    const totalPrice = itemsPrice + shippingPrice + taxPrice - discountAmount;

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      taxPrice,
      discountAmount,
      totalPrice,
      coupon,
      notes,
      statusHistory: [{ status: 'placed', note: 'Order placed successfully' }],
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    // Clear MongoDB cart after order (if it existed)
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], coupon: null, discountAmount: 0 });

    res.status(201).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create Razorpay payment order
exports.createPaymentOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (!razorpay) {
      return res.status(400).json({ success: false, message: 'Payment gateway not configured. Please use COD or contact support.' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.totalPrice * 100),
      currency: 'INR',
      receipt: order.orderNumber,
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({ success: true, razorpayOrder, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: 'paid',
        razorpayPaymentId,
        razorpaySignature,
        orderStatus: 'confirmed',
        $push: { statusHistory: { status: 'confirmed', note: 'Payment received' } },
      },
      { new: true }
    );

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user orders
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin: Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { orderStatus: status } : {};
    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(query).populate('user', 'name email').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Order.countDocuments(query),
    ]);

    res.json({ success: true, orders, total, pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin: Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, note, trackingNumber, courierName } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        orderStatus: status,
        trackingNumber,
        courierName,
        ...(status === 'delivered' ? { deliveredAt: Date.now() } : {}),
        $push: { statusHistory: { status, note } },
      },
      { new: true }
    );
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
