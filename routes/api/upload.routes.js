const express = require('express');
const router = express.Router();
const uploadController = require('../../controllers/upload.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

// Root is /api/upload
router.post('/', authMiddleware, upload.single('media'), uploadController.uploadMedia);

module.exports = router;
