const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validate.middleware');
const { uploadReport, getReports, getReport, updateMarkers } = require('../controllers/genetic.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Magic-byte file type validator ──────────────────────────────────────────
// Checks the raw buffer signature to ensure only genuine PDF or image files
// are accepted — prevents polyglot/RCE payloads from reaching the controller.
const ALLOWED_SIGNATURES = [
  { mime: 'application/pdf',  bytes: [0x25, 0x50, 0x44, 0x46, 0x2D] }, // %PDF-
  { mime: 'image/png',        bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D] }, // PNG
  { mime: 'image/jpeg',       bytes: [0xFF, 0xD8, 0xFF]              }, // JPEG/JPG
  { mime: 'image/gif',        bytes: [0x47, 0x49, 0x46, 0x38]        }, // GIF8
  { mime: 'image/webp',       bytes: [0x52, 0x49, 0x46, 0x46]        }, // RIFF (WebP)
];

const validateFileMagicBytes = (req, res, next) => {
  // When a file is present it must have a valid signature.
  // If no file is provided (manual markers path) skip this check.
  if (!req.file) return next();

  if (req.file.buffer.length < 5) {
    return res.status(400).json({ error: 'File is too small or empty.' });
  }

  const buf = req.file.buffer;
  const isAllowed = ALLOWED_SIGNATURES.some(({ bytes }) =>
    bytes.every((byte, i) => buf[i] === byte)
  );

  if (!isAllowed) {
    return res.status(400).json({
      error: 'Invalid file type. Only PDF and approved image formats are accepted.',
    });
  }

  next();
};

router.use(protect);
// Stage order: auth → multer (file + body parse) → magic bytes → Joi DTO → controller
router.post('/upload', authorize('doctor', 'admin'), upload.single('reportFile'), validateFileMagicBytes, validate(schemas.uploadReportSchema), uploadReport);
router.get('/:childId', getReports);
router.get('/report/:id', getReport);
router.put('/report/:id/markers', authorize('doctor', 'admin'), updateMarkers);

module.exports = router;

