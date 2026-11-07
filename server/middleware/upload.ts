import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({ storage, limits: { fileSize: 3 * 1024 * 1024, files: 5, fields: 30 }, fileFilter: (_req, file, done) => { if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return done(new Error('Choose a JPEG, PNG or WebP image.')); done(null, true); } });

export default upload;
