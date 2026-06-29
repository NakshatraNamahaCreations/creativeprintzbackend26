const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { saveDesign, getMyDesigns, getDesign, deleteDesign, uploadArtwork } = require('../controllers/designController');

router.use(protect);

router.get('/', getMyDesigns);
router.post('/', saveDesign);
router.get('/:id', getDesign);
router.delete('/:id', deleteDesign);
router.post('/upload/artwork', upload.single('artwork'), uploadArtwork);

module.exports = router;
