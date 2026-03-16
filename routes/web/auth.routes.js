const express = require('express');
const router = express.Router();
const webController = require('../../controllers/web.controller');
const { logout } = require('../../controllers/auth.controller');

router.get('/', webController.renderHome);
router.get('/login', webController.renderLogin);
router.get('/signup', webController.renderSignup);
router.get('/about', webController.renderAbout);
router.get('/cache-buster', webController.renderCacheBuster);
router.get('/logout', logout);

module.exports = router;
