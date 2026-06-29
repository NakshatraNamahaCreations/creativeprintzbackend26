const mongoose = require('mongoose');

const designSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, default: 'Untitled Design' },
    canvasData: { type: Object },     // Fabric.js JSON — front side
    canvasDataBack: { type: Object }, // Fabric.js JSON — back side (visiting cards, t-shirt back, etc.)
    previewImage: String,             // front design preview
    previewImageBack: String,         // back design preview
    uploadedFiles: [{ url: String, publicId: String }],
    selectedSize: String,
    selectedMaterial: String,
    selectedFinish: String,
    isTemplate: { type: Boolean, default: false },
    isSaved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Design', designSchema);
