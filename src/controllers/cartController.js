const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

// @desc    Get cart
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'name images basePrice discountPrice slug');
    res.json({ success: true, cart: cart || { items: [], totalAmount: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, selectedSize, selectedMaterial, selectedFinish, selectedQuantity, customDesign, previewImage, previewImageBack } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Use the price sent from client (custom design price) if provided, otherwise derive from product
    const price = req.body.price ?? product.discountPrice ?? product.basePrice;

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId &&
        item.selectedSize === selectedSize &&
        item.selectedFinish === selectedFinish &&
        item.customDesign?.toString() === (customDesign || undefined)?.toString()
    );

    if (existingItem && customDesign) {
      // Same design re-added after "Edit design": refresh that line instead of doubling it
      Object.assign(existingItem, { price, selectedQuantity, previewImage, previewImageBack });
    } else if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity, price, selectedSize, selectedMaterial, selectedFinish, selectedQuantity, customDesign, previewImage, previewImageBack });
    }

    await cart.save();
    await cart.populate('items.product', 'name images basePrice discountPrice slug');
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update cart item
exports.updateCartItem = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    if (req.body.quantity <= 0) {
      cart.items.pull(req.params.itemId);
    } else {
      item.quantity = req.body.quantity;
    }

    await cart.save();
    await cart.populate('items.product', 'name images basePrice discountPrice slug');
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove item from cart
exports.removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    cart.items.pull(req.params.itemId);
    await cart.save();
    await cart.populate('items.product', 'name images basePrice discountPrice slug');
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear cart
exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], coupon: null, discountAmount: 0 });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Apply coupon
exports.applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return res.status(404).json({ success: false, message: 'Invalid coupon code' });

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ success: false, message: 'Coupon has expired' });
    }
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (subtotal < coupon.minimumOrderAmount) {
      return res.status(400).json({ success: false, message: `Minimum order amount is ₹${coupon.minimumOrderAmount}` });
    }

    let discount = coupon.discountType === 'percentage'
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;

    if (coupon.maximumDiscountAmount) discount = Math.min(discount, coupon.maximumDiscountAmount);

    cart.coupon = coupon._id;
    cart.discountAmount = discount;
    await cart.save();

    res.json({ success: true, discount, message: `Coupon applied! You saved ₹${discount.toFixed(2)}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
