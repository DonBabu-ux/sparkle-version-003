const express = require('express');
const router = express.Router();
const groupsController = require('../../controllers/groups.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

router.get('/campus', authMiddleware, groupsController.getCampusGroups);
router.post('/', authMiddleware, groupsController.createGroup);
router.post('/:id/join', authMiddleware, groupsController.joinGroup);

module.exports = router;
