const express = require('express');
const router = express.Router();
const lostFoundController = require('../../controllers/lostFound.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { postUpload } = require('../../middleware/upload.middleware');

// Base path in index.js is `/lost-found`

// Browse items
router.get('/', lostFoundController.getFeed);

// Get single item
router.get('/:id', lostFoundController.getItem);

// Report a lost/found item
router.post('/', authMiddleware, postUpload.array('media', 3), lostFoundController.reportItem);

// Claim an item (reporter)
router.post('/:id/claim', authMiddleware, lostFoundController.claimItem);
router.put('/:id/claim', authMiddleware, lostFoundController.claimItem); // DashboardAPI compatibility

// Mark as returned/resolved
router.put('/:id/status', authMiddleware, lostFoundController.markReturned);

// Delete an item
router.delete('/:id', authMiddleware, lostFoundController.deleteItem);

module.exports = router;
