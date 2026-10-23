const express = require('express');
const router = express.Router();
const confessionController = require('../../controllers/confession.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');
const { mutationRateLimiter } = require('../../middleware/security.middleware');

// Public - browse confessions (optionally by affiliation)
router.get('/', confessionController.getConfessionsByAffiliation);
router.get('/community/:campus', confessionController.getConfessionsByAffiliation);
router.get('/:id', confessionController.getConfessionById);

// Protected
router.post('/', authMiddleware, mutationRateLimiter, upload.single('image'), confessionController.createConfession);
router.post('/:id/react', authMiddleware, mutationRateLimiter, confessionController.reactToConfession);
router.post('/:id/report', authMiddleware, mutationRateLimiter, confessionController.reportConfession);
router.post('/:id/comments', authMiddleware, mutationRateLimiter, confessionController.commentAnonymously);
router.get('/:id/comments', confessionController.getComments);

module.exports = router;
