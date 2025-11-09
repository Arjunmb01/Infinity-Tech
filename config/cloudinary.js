
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'InfinityTech/products', 
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Only .jpg, .jpeg, .png, .webp, and .avif formats are allowed'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, 
}).fields([
  { name: 'images', maxCount: 5 },
  { name: 'newImage', maxCount: 1 },
]);

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ success: false, message: 'File too large (max 5MB)' });
    if (err.code === 'LIMIT_FILE_COUNT')
      return res.status(400).json({ success: false, message: 'Too many files. Max 5 images.' });
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.message) return res.status(400).json({ success: false, message: err.message });
  next(err);
};

module.exports = { cloudinary, upload, handleMulterError };
