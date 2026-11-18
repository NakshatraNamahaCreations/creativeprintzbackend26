const fs = require('fs');
const Setting = require('../models/Setting');
const cloudinary = require('../config/cloudinary');

// Settings anyone can read (the studio needs them); only admins can change them
const PUBLIC_KEYS = ['tshirt-model', 'cap-model'];

// @desc    Get a public setting
exports.getSetting = async (req, res) => {
  try {
    if (!PUBLIC_KEYS.includes(req.params.key)) return res.status(404).json({ success: false, message: 'Setting not found' });
    const setting = await Setting.findOne({ key: req.params.key }).lean();
    res.json({ success: true, value: setting ? setting.value : null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save a setting (admin)
exports.saveSetting = async (req, res) => {
  try {
    if (!PUBLIC_KEYS.includes(req.params.key)) return res.status(400).json({ success: false, message: 'Unknown setting' });
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      { value: req.body.value ?? {} },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    res.json({ success: true, value: setting.value });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload an image for a setting (admin) → Cloudinary URL
exports.uploadSettingImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const result = await cloudinary.uploader.upload(req.file.path, { folder: 'creative-printz/models' });
    fs.unlink(req.file.path, () => {});
    res.json({ success: true, url: result.secure_url, width: result.width, height: result.height });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, message: error.message });
  }
};
