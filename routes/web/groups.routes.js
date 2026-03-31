const express = require('express');
const router = express.Router();
const groupsController = require('../../controllers/groups.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');
const { csrfProtection } = require('../../middleware/security.middleware');

router.get('/groups', ejsAuthMiddleware, csrfProtection, groupsController.renderGroups);
router.get('/groups/:id', ejsAuthMiddleware, csrfProtection, groupsController.renderGroupDetail);
router.post('/groups/create', ejsAuthMiddleware, csrfProtection, groupsController.createGroup);
router.get('/groups-prototype', (req, res) => res.render('groups-prototype', { title: 'Prototype' }));

module.exports = router;
