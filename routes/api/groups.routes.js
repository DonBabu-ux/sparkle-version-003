const express = require('express');
const router = express.Router();
const groupsController = require('../../controllers/groups.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');
const { csrfProtection } = require('../../middleware/security.middleware');

// Apply CSRF protection to all state-changing routes
router.use(csrfProtection);

// Match spec: GET /api/groups
router.get('/', authMiddleware, groupsController.getGroupsAPI);

// Match spec: POST /api/groups
router.post('/', authMiddleware, upload.single('pfp'), groupsController.createGroup);

// Match spec: POST /api/groups/:id/post
router.post('/:id/post', authMiddleware, upload.single('image'), groupsController.createGroupPost);

// Match spec: GET /api/groups/:id/posts?page=1
router.get('/:id/posts', authMiddleware, groupsController.getGroupPostsAPI);

// Matching spec: GET /api/groups/:id/requests (Private admin API)
router.get('/:id/requests', authMiddleware, groupsController.getPendingRequestsAPI);

// Matching spec: POST /api/groups/requests/:requestId/approve
router.post('/requests/:requestId/approve', authMiddleware, groupsController.approveRequestAPI);
router.post('/requests/:requestId/reject', authMiddleware, groupsController.rejectRequestAPI);

// Common utilities
router.post('/:id/join', authMiddleware, groupsController.joinGroup);
router.post('/:id/leave', authMiddleware, groupsController.leaveGroup);
router.delete('/:id', authMiddleware, groupsController.deleteGroupAPI);
router.post('/:id/update', authMiddleware, upload.fields([{ name: 'icon', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), groupsController.updateGroupAPI);
router.get('/:id/members', authMiddleware, groupsController.getMembersDetailedAPI);
router.post('/:id/users/:userId/remove', authMiddleware, groupsController.removeMemberAPI);
router.post('/:id/users/:userId/promote', authMiddleware, groupsController.promoteMemberAPI);
router.delete('/:id/posts/:postId', authMiddleware, groupsController.deletePostAPI);

module.exports = router;
