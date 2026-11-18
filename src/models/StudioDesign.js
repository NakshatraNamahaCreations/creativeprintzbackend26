const mongoose = require('mongoose');

// Designs made in the public Design Studio (/design). Guests can use it, so the
// customer is identified by phone + email rather than a user account.
const studioDesignSchema = new mongoose.Schema(
  {
    designCode: { type: String, unique: true, index: true },
    name: { type: String, default: 'Untitled Design', trim: true },
    customer: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true, index: true },
      email: { type: String, trim: true, lowercase: true },
    },
    notes: { type: String, trim: true },
    productType: { type: String, required: true },
    productLabel: String,
    sizeLabel: String,
    width: { type: Number, required: true },  // canvas size in px
    height: { type: Number, required: true },
    canvasData: { type: Object },             // Fabric.js JSON
    previewImage: String,                     // small PNG data URL
    status: {
      type: String,
      enum: ['draft', 'sent', 'in-progress', 'printed', 'cancelled'],
      default: 'draft',
    },
    sentAt: Date,
  },
  { timestamps: true }
);

studioDesignSchema.pre('save', function () {
  if (!this.designCode) {
    this.designCode = 'CP-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  }
});

module.exports = mongoose.model('StudioDesign', studioDesignSchema);
