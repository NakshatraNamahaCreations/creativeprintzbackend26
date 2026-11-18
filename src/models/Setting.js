const mongoose = require('mongoose');

// Small site-wide settings managed from the admin panel (e.g. the T-shirt model photos)
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
