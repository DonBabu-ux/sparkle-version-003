const express = require('express');
const router = express.Router();
const groupsController = require('../../controllers/groups.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

router.get('/campus', authMiddleware, groupsController.getCampusGroups);
router.post('/', authMiddleware, upload.single('pfp'), groupsController.createGroup);
router.post('/:id/join', authMiddleware, groupsController.joinGroup);
router.put('/:id', authMiddleware, upload.single('pfp'), groupsController.updateGroup);
router.post('/:id/posts', authMiddleware, groupsController.createGroupPost);

module.exports = router;
