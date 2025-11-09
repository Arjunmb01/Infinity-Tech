const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createUploadDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error('Only .jpg, .jpeg, .png, .webp, and .avif formats are allowed'), false);
    }
    cb(null, true);
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/products');
        createUploadDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `product-${uniqueSuffix}${ext}`);
    }
});

// Flexible Multer configuration to handle both multiple 'images' and single 'newImage'
const uploadConfig = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 
    }
}).fields([
    { name: 'images', maxCount: 5 }, 
    { name: 'newImage', maxCount: 1 } 
]);

const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ success: false, message: 'Too many files. Maximum of 5 images allowed.' });
        }
        return res.status(400).json({ success: false, message: err.message });
    }
    if (err.message) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
};

module.exports = {
    upload: uploadConfig,
    handleMulterError
};