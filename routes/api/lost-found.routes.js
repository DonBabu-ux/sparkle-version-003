const express = require('express');
const router = express.Router();
const lostFoundController = require('../../controllers/lostFound.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const upload = require('../../utils/fileUpload');

// Base path in index.js is `/lost-found`

// Browse items
router.get('/', lostFoundController.getFeed);

// Get single item
router.get('/:id', lostFoundController.getItem);

// Report a lost/found item
router.post('/', authMiddleware, upload.array('media', 3), lostFoundController.reportItem);

// Claim an item (reporter)
router.post('/:id/claim', authMiddleware, lostFoundController.claimItem);

// Mark as returned/resolved
router.put('/:id/status', authMiddleware, lostFoundController.markReturned);

// Delete an item
router.delete('/:id', authMiddleware, lostFoundController.deleteItem);

module.exports = router;
