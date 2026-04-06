const express = require('express');
const router = express.Router();
const momentsController = require('../../controllers/moments.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');


// Stream endpoints
router.get('/stream', authMiddleware, momentsController.getMomentsStream);

// CRUD operations
router.post('/',
    authMiddleware,
    upload.single('media'),
    momentsController.createMoment
);

// Interaction endpoints
router.post('/:id/spark', authMiddleware, momentsController.sparkMoment);
router.post('/:id/save', authMiddleware, momentsController.saveMoment);
router.post('/:id/share', authMiddleware, momentsController.trackShare);
router.get('/:id/share-data', authMiddleware, momentsController.getShareData);

// Comment endpoints
router.get('/:id/comments', authMiddleware, momentsController.getComments);
router.post('/:id/comments', authMiddleware, momentsController.addComment);
router.post('/comment/:id/like', authMiddleware, momentsController.likeComment);

// User interaction
router.post('/user/:userId/follow', authMiddleware, momentsController.followUser);

// DashboardAPI Compatibility
router.get('/users/:userId/moments', authMiddleware, momentsController.getMomentsStream); // Filter by user_id in controller

module.exports = router;
