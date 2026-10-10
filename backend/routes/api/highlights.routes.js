const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');
const {
    getHighlight,
    getUserHighlights,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    addStoriesToHighlight,
    removeStoryFromHighlight,
    getStoryArchive
} = require('../../controllers/highlight.controller');

// Archive (current user's expired stories)
router.get('/archive', authMiddleware, getStoryArchive);

// Highlight CRUD
router.post('/', authMiddleware, createHighlight);
router.get('/:id', authMiddleware, getHighlight);
router.put('/:id', authMiddleware, updateHighlight);
router.delete('/:id', authMiddleware, deleteHighlight);

// Stories within a highlight
router.post('/:id/stories', authMiddleware, addStoriesToHighlight);
router.delete('/:id/stories/:storyId', authMiddleware, removeStoryFromHighlight);

module.exports = router;
