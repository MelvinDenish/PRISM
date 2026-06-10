/**
 * Multipart upload middleware (multer, in-memory) for mentor resource files.
 * Memory storage so the buffer can be handed straight to the storage adapter
 * (local disk or S3) — the route decides where it lands. Allowlist + size cap.
 */
const multer = require('multer');

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',                                             // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword',                                                        // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // .docx
  'application/vnd.ms-excel',                                                  // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         // .xlsx
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain', 'application/zip',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(new Error('Unsupported file type. Allowed: PDF, PPT(X), DOC(X), XLS(X), images, TXT, ZIP.'));
  },
});

// Single optional file under field "file". Wraps multer so a filter/size error
// returns a clean 400 instead of crashing the request.
const singleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
};

module.exports = { singleFile };
