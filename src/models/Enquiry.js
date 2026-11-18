const mongoose = require('mongoose');

// Quote requests from the homepage "Request a Quote" form
const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Full name is required'], trim: true },
    phone: { type: String, required: [true, 'Phone / WhatsApp number is required'], trim: true },
    service: { type: String, required: [true, 'Please choose a service'], trim: true },
    dimensions: { type: String, trim: true },
    quantity: { type: String, trim: true },
    deliveryDate: { type: String, trim: true },
    installation: { type: Boolean, default: false },
    message: { type: String, trim: true },
    // Artwork is stored in MongoDB GridFS (bucket "enquiryFiles") so it survives server restarts
    files: [{ fileId: mongoose.Schema.Types.ObjectId, filename: String, size: Number, contentType: String }],
    status: { type: String, enum: ['new', 'contacted', 'quoted', 'won', 'lost'], default: 'new' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Enquiry', enquirySchema);
