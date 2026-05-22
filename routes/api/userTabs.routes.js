// routes/api/userTabs.routes.js
// Routes for per‑user custom tabs

const express = require('express');
const router = express.Router();
const userTabsController = require('../../controllers/userTabs.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// All routes are scoped to a user ID and require auth
router.get('/:id/tabs', authMiddleware, userTabsController.getUserTabs);
router.post('/:id/tabs', authMiddleware, userTabsController.createUserTab);
router.put('/:id/tabs/:tabId', authMiddleware, userTabsController.updateUserTab);
router.delete('/:id/tabs/:tabId', authMiddleware, userTabsController.deleteUserTab);

module.exports = router;
