const express = require('express');
const router = express.Router();
const momentsController = require('../../controllers/moments.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/moments', ejsAuthMiddleware, momentsController.renderMoments);
router.get('/moments/create', ejsAuthMiddleware, (req, res) => {
    res.render('create-moment', { 
        title: 'Create Moment', 
        user: req.user 
    });
});
router.get('/moments/:id', ejsAuthMiddleware, momentsController.renderMomentDetail);

module.exports = router;