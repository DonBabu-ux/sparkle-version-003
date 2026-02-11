const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/skill-market', authMiddleware, (req, res) => {
    res.render('skill-marketplace', {
        title: 'Skill Marketplace | Sparkle',
        user: req.user,
        path: '/skill-marketplace'
    });
});

module.exports = router;
