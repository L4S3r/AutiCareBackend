const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth.middleware');
const { uploadReport, getReports, getReport, updateMarkers } = require('../controllers/genetic.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect);
router.post('/upload', authorize('doctor', 'admin'), upload.single('reportFile'), uploadReport);
router.get('/:childId', getReports);
router.get('/report/:id', getReport);
router.put('/report/:id/markers', authorize('doctor', 'admin'), updateMarkers);

module.exports = router;
