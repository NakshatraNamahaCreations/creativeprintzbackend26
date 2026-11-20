const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  createDesign, updateDesign, findDesigns, getDesign, sendForPrinting, generateAiImage, startAiImageJob, getAiImageJob,
  getAllDesigns, getDesignAdmin, updateStatus,
} = require('../controllers/studioController');

// Admin
router.get('/admin/all', protect, adminOnly, getAllDesigns);
router.get('/admin/:id', protect, adminOnly, getDesignAdmin);
router.put('/admin/:id/status', protect, adminOnly, updateStatus);

// Public (guests can design without an account)
router.post('/ai-image', generateAiImage);
// Long AI pictures: start a job, then poll (keeps every request short, so proxies never time out)
router.post('/ai-image/jobs', startAiImageJob);
router.get('/ai-image/jobs/:id', getAiImageJob);
router.get('/find', findDesigns);
router.post('/', createDesign);
router.get('/:id', getDesign);
router.put('/:id', updateDesign);
router.post('/:id/send', sendForPrinting);

module.exports = router;
