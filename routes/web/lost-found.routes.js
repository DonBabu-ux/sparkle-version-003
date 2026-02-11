const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/lost-found', authMiddleware, (req, res) => {
    res.render('lost-found', {
        title: 'Lost & Found | Sparkle',
        user: req.user,
        path: '/lost-found'
    });
});

module.exports = router;
