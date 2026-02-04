const express = require('express');
const router = express.Router();
const momentsController = require('../../controllers/moments.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

router.get('/stream', authMiddleware, momentsController.getMomentsStream);
router.get('/user/:userId', authMiddleware, momentsController.getUserMoments);
router.post('/', authMiddleware, upload.single('media'), momentsController.createMoment);

module.exports = router;
