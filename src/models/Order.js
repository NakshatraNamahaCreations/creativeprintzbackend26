const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  image: String,
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  selectedSize: String,
  selectedMaterial: String,
  selectedFinish: String,
  selectedQuantity: Number,
  customDesign: { type: mongoose.Schema.Types.ObjectId, ref: 'Design' },
  previewImage: String,
  previewImageBack: String,
});

const shippingAddressSchema = new mongoose.Schema({
  name: String,
  phone: String,
  addressLine1: String,
  addressLine2: String,
  city: String,
  state: String,
  pincode: String,
});

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber: { type: String, unique: true },
    items: [orderItemSchema],
    shippingAddress: shippingAddressSchema,
    paymentMethod: { type: String, enum: ['razorpay', 'cod', 'upi', 'card'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    itemsPrice: { type: Number, required: true },
    shippingPrice: { type: Number, default: 0 },
    taxPrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },

    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },

    orderStatus: {
      type: String,
      enum: ['placed', 'confirmed', 'designing', 'printing', 'dispatched', 'delivered', 'cancelled', 'returned'],
      default: 'placed',
    },
    trackingNumber: String,
    courierName: String,

    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],

    deliveredAt: Date,
    estimatedDelivery: Date,
    notes: String,
  },
  { timestamps: true }
);

orderSchema.pre('save', function () {
  if (!this.orderNumber) {
    this.orderNumber = 'CP' + Date.now() + Math.floor(Math.random() * 1000);
  }
});

module.exports = mongoose.model('Order', orderSchema);
