const path = require('path');
const express = require('express');
const router = express.Router();
const momentsController = require(path.join(__dirname, '..', '..', 'controllers', 'moments.controller');
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');
const { upload } = require(path.join(__dirname, '..', '..', 'middleware', 'upload.middleware');

router.get('/stream', authMiddleware, momentsController.getMomentsStream);
router.get('/user/:userId', authMiddleware, momentsController.getUserMoments);
router.post('/', authMiddleware, upload.single('media'), momentsController.createMoment);
router.post('/:id/spark', authMiddleware, momentsController.sparkMoment);
router.post('/:id/share', authMiddleware, momentsController.trackShare);
router.get('/:id/share-data', authMiddleware, momentsController.getShareData);

module.exports = router;

