const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getSetting, saveSetting, uploadSettingImage } = require('../controllers/settingController');

router.get('/:key', getSetting);
router.put('/:key', protect, adminOnly, saveSetting);
router.post('/upload', protect, adminOnly, upload.single('image'), uploadSettingImage);

module.exports = router;
