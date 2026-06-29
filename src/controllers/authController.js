const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

// @desc    Register user
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    const user = await User.create({ name, email, password, phone });
    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated' });
    }
    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, phone }, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user found with that email' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Password Reset - Creative Printz',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 10 minutes.</p>`,
    });
    res.json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset password
exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    const token = generateToken(user._id);
    res.json({ success: true, token, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add/update address
exports.addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }
    user.addresses.push(req.body);
    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete address
exports.deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses = user.addresses.filter((addr) => addr._id.toString() !== req.params.id);
    await user.save();
    res.json({ success: true, addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get wishlist
exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist', 'name slug images basePrice discountPrice averageRating');
    res.json({ success: true, wishlist: user.wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add product to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    const user = await User.findById(req.user._id);
    if (user.wishlist.includes(productId)) {
      return res.json({ success: true, message: 'Already in wishlist', wishlist: user.wishlist });
    }
    user.wishlist.push(productId);
    await user.save();
    res.json({ success: true, message: 'Added to wishlist', wishlist: user.wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove product from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    await User.findByIdAndUpdate(req.user._id, { $pull: { wishlist: productId } });
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
