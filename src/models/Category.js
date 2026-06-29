const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true },
    description: String,
    image: String,
    icon: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    metaTitle: String,
    metaDescription: String,
  },
  { timestamps: true }
);

categorySchema.pre('save', function () {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true });
  }
});

module.exports = mongoose.model('Category', categorySchema);
