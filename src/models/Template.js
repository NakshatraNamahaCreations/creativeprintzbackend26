const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    thumbnail: String,
    canvasData: Object, // Fabric.js JSON
    tags: [String],
    industry: String,
    isPremium: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Template', templateSchema);
