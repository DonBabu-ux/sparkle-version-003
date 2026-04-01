const express = require('express');
const router = express.Router();
const confessionController = require('../../controllers/confession.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// Public — browse confessions (optionally by affiliation)
router.get('/', confessionController.getConfessionsByAffiliation);                                   // affiliation filter via ?campus=X
router.get('/community/:campus', confessionController.getConfessionsByAffiliation);                  // NEW — explicit affiliation filter

// Protected
router.post('/', authMiddleware, confessionController.createConfession);                         // Post anonymous confession
router.post('/:id/react', authMiddleware, confessionController.reactToConfession);              // Like / react
router.post('/:id/report', authMiddleware, confessionController.reportConfession);              // NEW — report confession
router.post('/:id/comments', authMiddleware, confessionController.commentAnonymously);          // NEW — anonymous comment
router.get('/:id/comments', confessionController.getComments);                                  // NEW — get comments

module.exports = router;
