const express = require('express');
const router = express.Router();
const confessionController = require('../../controllers/confession.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/', authMiddleware, confessionController.renderConfessions);
router.post('/', authMiddleware, confessionController.createConfession);
router.post('/:id/react', authMiddleware, confessionController.reactToConfession);

module.exports = router;
