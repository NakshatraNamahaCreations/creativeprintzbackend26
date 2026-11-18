const mongoose = require('mongoose');
const { Readable } = require('stream');
const Enquiry = require('../models/Enquiry');

const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
const isObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'enquiryFiles' });

const saveToGridFS = (file) => new Promise((resolve, reject) => {
  const upload = bucket().openUploadStream(file.originalname, { metadata: { contentType: file.mimetype } });
  Readable.from(file.buffer).pipe(upload)
    .on('error', reject)
    .on('finish', () => resolve({
      fileId: upload.id, filename: file.originalname, size: file.size, contentType: file.mimetype,
    }));
});

// POST /api/enquiries  (public, multipart with optional "files")
exports.createEnquiry = async (req, res, next) => {
  try {
    // Hidden field real visitors never fill in
    if (req.body.website) return res.status(201).json({ success: true });

    const phoneDigits = String(req.body.phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone / WhatsApp number' });
    }

    const files = [];
    for (const file of req.files || []) files.push(await saveToGridFS(file));

    const enquiry = await Enquiry.create({
      name: req.body.name,
      phone: req.body.phone,
      service: req.body.service,
      dimensions: req.body.dimensions,
      quantity: req.body.quantity,
      deliveryDate: req.body.deliveryDate,
      installation: req.body.installation === 'yes' || req.body.installation === 'true',
      message: req.body.message,
      files,
    });
    res.status(201).json({ success: true, enquiryId: enquiry._id });
  } catch (error) {
    next(error);
  }
};

// GET /api/enquiries  (admin)
exports.getEnquiries = async (req, res, next) => {
  try {
    const filter = {};
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const enquiries = await Enquiry.find(filter).sort('-createdAt').limit(300);
    res.json({ success: true, enquiries });
  } catch (error) {
    next(error);
  }
};

// PUT /api/enquiries/:id/status  (admin)
exports.updateEnquiryStatus = async (req, res, next) => {
  try {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    if (!isObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    res.json({ success: true, enquiry });
  } catch (error) {
    next(error);
  }
};

// GET /api/enquiries/files/:fileId  (admin) — streams an uploaded artwork file
exports.downloadFile = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.fileId)) return res.status(404).json({ success: false, message: 'File not found' });
    const id = new mongoose.Types.ObjectId(req.params.fileId);
    const [file] = await bucket().find({ _id: id }).toArray();
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    res.set('Content-Type', file.metadata?.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    bucket().openDownloadStream(id).on('error', next).pipe(res);
  } catch (error) {
    next(error);
  }
};
