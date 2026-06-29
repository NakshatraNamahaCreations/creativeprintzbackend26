const mongoose = require('mongoose');
const slugify = require('slugify');

const variantSchema = new mongoose.Schema({
  size: String,
  material: String,
  finish: String,
  quantity: Number,
  price: { type: Number, required: true },
  discountPrice: Number,
  stock: { type: Number, default: 0 },
  sku: String,
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    shortDescription: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    images: [{ url: String, alt: String }],
    basePrice: { type: Number, required: true },
    discountPrice: Number,
    discountPercentage: Number,
    variants: [variantSchema],

    // Customization options
    colors: [{ label: String, value: String, hex: String, image: String }],
    sizes: [{ label: String, value: String, width: Number, height: Number, unit: String }],
    materials: [{ label: String, value: String }],
    finishes: [{ label: String, value: String, extraCost: Number }],
    quantityOptions: [{ qty: Number, price: Number, discountPrice: Number }],

    // Design
    allowCustomDesign: { type: Boolean, default: true },
    templates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Template' }],
    designAreas: [{ name: String, x: Number, y: Number, width: Number, height: Number }],

    // Delivery
    minDeliveryDays: { type: Number, default: 5 },
    maxDeliveryDays: { type: Number, default: 10 },

    // Ratings
    averageRating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },

    // Meta
    tags: [String],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    metaTitle: String,
    metaDescription: String,
  },
  { timestamps: true }
);

productSchema.pre('save', function () {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true });
  }
  if (this.discountPrice && this.basePrice) {
    this.discountPercentage = Math.round(((this.basePrice - this.discountPrice) / this.basePrice) * 100);
  }
});

productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: 1 });

module.exports = mongoose.model('Product', productSchema);
