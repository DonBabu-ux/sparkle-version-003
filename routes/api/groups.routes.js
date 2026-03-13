const express = require('express');
const router = express.Router();
const groupsController = require('../../controllers/groups.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');

// Existing
router.get('/campus', authMiddleware, groupsController.getCampusGroups);
router.post('/', authMiddleware, upload.single('pfp'), groupsController.createGroup);
router.post('/:id/join', authMiddleware, groupsController.joinGroup);
router.delete('/:id/leave', authMiddleware, groupsController.leaveGroup);          // NEW
router.put('/:id', authMiddleware, upload.single('pfp'), groupsController.updateGroup);
router.post('/:id/posts', authMiddleware, groupsController.createGroupPost);

// Members
router.get('/:id/members', authMiddleware, groupsController.getGroupMembers);                       // NEW
router.get('/:id/requests', authMiddleware, groupsController.getPendingRequests);                   // NEW
router.post('/:id/members/:userId/approve', authMiddleware, groupsController.approveRequest);       // NEW
router.put('/:id/members/:userId/promote', authMiddleware, groupsController.promoteAdmin);          // NEW
router.delete('/:id/members/:userId', authMiddleware, groupsController.removeMemberByAdmin);        // NEW

module.exports = router;
