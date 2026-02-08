const path = require('path');
const express = require('express');
const router = express.Router();
const uploadController = require(path.join(__dirname, '..', '..', 'controllers', 'upload.controller');
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');
const { upload } = require(path.join(__dirname, '..', '..', 'middleware', 'upload.middleware');

// Root is /api/upload
router.post('/', authMiddleware, upload.single('media'), uploadController.uploadMedia);

module.exports = router;

