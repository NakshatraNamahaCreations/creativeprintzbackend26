const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { createEnquiry, getEnquiries, updateEnquiryStatus, downloadFile } = require('../controllers/enquiryController');

// Artwork comes in many formats (PDF, AI, PSD, CDR, PNG, JPG…), so only size and count are limited
const artworkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
});

const handleUpload = (req, res, next) => {
  artworkUpload.array('files', 5)(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 15 MB or smaller'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'You can attach up to 5 files'
      : 'Could not upload the files';
    res.status(400).json({ success: false, message });
  });
};

router.post('/', handleUpload, createEnquiry);
router.get('/', protect, adminOnly, getEnquiries);
router.put('/:id/status', protect, adminOnly, updateEnquiryStatus);
router.get('/files/:fileId', protect, adminOnly, downloadFile);

module.exports = router;
