const express = require('express');
const router = express.Router();
const uploadController = require('../../controllers/upload.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload, messageUpload } = require('../../middleware/upload.middleware');

// Root is /api/upload
router.post('/', authMiddleware, upload.single('media'), uploadController.uploadMedia);
router.post('/message', authMiddleware, messageUpload.single('file'), uploadController.uploadMedia);

module.exports = router;
