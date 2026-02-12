import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'menu-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit (increased from 5MB)
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'));
    }
  }
});

// POST /api/v1/upload/image - Upload single image
router.post('/image', (req, res) => {
  // Use multer middleware with error handling
  upload.single('image')(req, res, (err) => {
    try {
      console.log('📤 [UPLOAD] Received upload request');

      // Handle multer errors
      if (err instanceof multer.MulterError) {
        console.error('❌ [UPLOAD] Multer error:', err.code, err.message);

        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large. Maximum file size is 10MB.'
          });
        }
        return res.status(400).json({
          error: `Upload error: ${err.message}`
        });
      } else if (err) {
        console.error('❌ [UPLOAD] File filter error:', err.message);
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        console.error('❌ [UPLOAD] No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log('📤 [UPLOAD] File received:', {
        originalname: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      });

      // Return the URL path to the uploaded file
      const imageUrl = `/uploads/${req.file.filename}`;
      console.log('✅ [UPLOAD] Upload successful! Returning URL:', imageUrl);
      res.json({ url: imageUrl });
    } catch (error) {
      console.error('❌ [UPLOAD] Error uploading image:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  });
});

export default router;
