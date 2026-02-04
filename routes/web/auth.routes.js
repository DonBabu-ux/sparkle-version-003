const express = require('express');
const router = express.Router();
const webController = require('../../controllers/web.controller');

router.get('/', webController.renderHome);
router.get('/login', webController.renderLogin);
router.get('/signup', webController.renderSignup);
router.get('/about', webController.renderAbout);
router.get('/cache-buster', webController.renderCacheBuster);

module.exports = router;
