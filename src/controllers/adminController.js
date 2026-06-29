const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');

// @desc    Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalOrders, totalRevenue, totalUsers, totalProducts,
      monthlyOrders, monthlyRevenue, pendingOrders, recentOrders,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
      User.countDocuments({ role: 'user' }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments({ createdAt: { $gte: thisMonth } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),
      Order.countDocuments({ orderStatus: { $in: ['placed', 'confirmed'] } }),
      Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(10),
    ]);

    // Monthly revenue chart (last 6 months)
    const revenueChart = await Order.aggregate([
      { $match: { createdAt: { $gte: new Date(today.getFullYear(), today.getMonth() - 5, 1) } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalPrice' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalUsers,
        totalProducts,
        monthlyOrders,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        pendingOrders,
      },
      recentOrders,
      revenueChart,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = search ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] } : {};
    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({ success: true, users, total, pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle user status
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create coupon
exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all coupons
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update coupon
exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete coupon
exports.deleteCoupon = async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
