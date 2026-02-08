const path = require('path');
const express = require('express');
const router = express.Router();
const groupsController = require(path.join(__dirname, '..', '..', 'controllers', 'groups.controller');
const { ejsAuthMiddleware } = require(path.join(__dirname, '..', '..', 'middleware', 'auth.middleware');

router.get('/groups', ejsAuthMiddleware, groupsController.renderGroups);
router.get('/groups/feed', ejsAuthMiddleware, groupsController.renderGroupFeed);
router.get('/groups/:id', ejsAuthMiddleware, groupsController.renderGroupDetail);

module.exports = router;

