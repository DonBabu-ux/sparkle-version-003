const express = require('express');
const router = express.Router();
const confessionController = require('../../controllers/confession.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Public — browse confessions (optionally by campus)
router.get('/', confessionController.getConfessionsByCampus);                                   // campus filter via ?campus=X
router.get('/campus/:campus', confessionController.getConfessionsByCampus);                     // NEW — explicit campus filter

// Protected
router.post('/', authMiddleware, confessionController.createConfession);                         // Post anonymous confession
router.post('/:id/react', authMiddleware, confessionController.reactToConfession);              // Like / react
router.post('/:id/report', authMiddleware, confessionController.reportConfession);              // NEW — report confession
router.post('/:id/comments', authMiddleware, confessionController.commentAnonymously);          // NEW — anonymous comment
router.get('/:id/comments', confessionController.getComments);                                  // NEW — get comments

module.exports = router;
