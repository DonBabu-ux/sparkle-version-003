const path = require('path');
const express = require('express');
const router = express.Router();
const confessionController = require(path.join(__dirname, '..', '..', 'controllers', 'confession.controller');
const { authMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/', authMiddleware, confessionController.renderConfessions);
router.post('/', authMiddleware, confessionController.createConfession);
router.post('/:id/react', authMiddleware, confessionController.reactToConfession);

module.exports = router;

