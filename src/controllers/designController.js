const Design = require('../models/Design');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// @desc    Save / update a design
exports.saveDesign = async (req, res) => {
  try {
    const { designId, name, canvasData, canvasDataBack, previewImage, previewImageBack, selectedSize, selectedMaterial, selectedFinish, product } = req.body;

    if (designId) {
      // Update existing
      const design = await Design.findOneAndUpdate(
        { _id: designId, user: req.user._id },
        { name, canvasData, canvasDataBack, previewImage, previewImageBack, selectedSize, selectedMaterial, selectedFinish, isSaved: true },
        { new: true }
      );
      if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
      return res.json({ success: true, design });
    }

    // Create new
    const design = await Design.create({
      user: req.user._id,
      product,
      name: name || 'Untitled Design',
      canvasData,
      canvasDataBack,
      previewImage,
      previewImageBack,
      selectedSize,
      selectedMaterial,
      selectedFinish,
      isSaved: true,
    });

    res.status(201).json({ success: true, design });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all saved designs for the logged-in user
exports.getMyDesigns = async (req, res) => {
  try {
    const designs = await Design.find({ user: req.user._id, isSaved: true })
      .populate('product', 'name slug images')
      .sort({ updatedAt: -1 });
    res.json({ success: true, designs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single design
exports.getDesign = async (req, res) => {
  try {
    const design = await Design.findOne({ _id: req.params.id, user: req.user._id }).populate('product', 'name slug');
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    res.json({ success: true, design });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a design
exports.deleteDesign = async (req, res) => {
  try {
    const design = await Design.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!design) return res.status(404).json({ success: false, message: 'Design not found' });
    res.json({ success: true, message: 'Design deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload artwork file (image) to Cloudinary
exports.uploadArtwork = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'creative-printz/artwork',
      allowed_formats: ['jpg', 'jpeg', 'png', 'svg', 'pdf'],
    });
    fs.unlinkSync(req.file.path);

    res.json({ success: true, url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
