const express = require('express');
const router = express.Router();

router.get('/support', (req, res) => {
    res.render('support', {
        title: 'Support Center',
        user: req.user || null
    });
});

module.exports = router;
