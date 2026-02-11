const express = require('express');
const router = express.Router();
const lostFoundController = require('../../controllers/lostFound.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

// Public routes
router.get('/items', lostFoundController.getFeed);
router.get('/items/:id', lostFoundController.getItem);

// Protected routes
router.post('/', authMiddleware, upload.array('media', 5), lostFoundController.reportItem);
router.post('/:id/claim', authMiddleware, lostFoundController.claimItem);
router.delete('/:id', authMiddleware, lostFoundController.deleteItem);

module.exports = router;
