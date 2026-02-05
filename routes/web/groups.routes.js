const express = require('express');
const router = express.Router();
const groupsController = require('../../controllers/groups.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/groups', ejsAuthMiddleware, groupsController.renderGroups);
router.get('/groups/feed', ejsAuthMiddleware, groupsController.renderGroupFeed);
router.get('/groups/:id', ejsAuthMiddleware, groupsController.renderGroupDetail);

module.exports = router;
