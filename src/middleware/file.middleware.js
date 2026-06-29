const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const ALLOWED_SIGNATURES = [
  { mime: 'application/pdf',  bytes: [0x25, 0x50, 0x44, 0x46, 0x2D] }, // %PDF-
  { mime: 'image/png',        bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D] }, // PNG
  { mime: 'image/jpeg',       bytes: [0xFF, 0xD8, 0xFF]              }, // JPEG/JPG
  { mime: 'image/gif',        bytes: [0x47, 0x49, 0x46, 0x38]        }, // GIF8
  { mime: 'image/webp',       bytes: [0x52, 0x49, 0x46, 0x46]        }, // RIFF (WebP)
];

const validateFileMagicBytes = (req, res, next) => {
  const filesToCheck = [];
  if (req.file) {
    filesToCheck.push(req.file);
  }
  if (req.files) {
    if (Array.isArray(req.files)) {
      filesToCheck.push(...req.files);
    } else {
      Object.values(req.files).forEach(fileArr => {
        if (Array.isArray(fileArr)) {
          filesToCheck.push(...fileArr);
        }
      });
    }
  }

  if (filesToCheck.length === 0) return next();

  for (const file of filesToCheck) {
    if (file.buffer.length < 5) {
      return res.status(400).json({ error: `File ${file.fieldname || ''} is too small or empty.` });
    }

    const buf = file.buffer;
    const isAllowed = ALLOWED_SIGNATURES.some(({ bytes }) =>
      bytes.every((byte, i) => buf[i] === byte)
    );

    if (!isAllowed) {
      return res.status(400).json({
        error: `Invalid file type for ${file.fieldname || 'file'}. Only PDF and approved image formats are accepted.`,
      });
    }
  }

  next();
};

module.exports = {
  upload,
  validateFileMagicBytes,
};
