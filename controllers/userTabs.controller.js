// controllers/userTabs.controller.js
// Handles CRUD for per‑user custom tabs

const { UserTab } = require('../models'); // adjust if using Sequelize init

// GET /api/user/:id/tabs – fetch tabs for a specific user
exports.getUserTabs = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const tabs = await UserTab.findAll({ where: { userId } });
    res.json({ success: true, data: tabs });
  } catch (err) {
    console.error('Error fetching user tabs', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tabs' });
  }
};

// POST /api/user/:id/tabs – create a new tab for the user
exports.createUserTab = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { tabId, label, chatIds } = req.body;
    const newTab = await UserTab.create({ userId, tabId, label, chatIds });
    res.status(201).json({ success: true, data: newTab });
  } catch (err) {
    console.error('Error creating user tab', err);
    res.status(500).json({ success: false, message: 'Failed to create tab' });
  }
};

// PUT /api/user/:id/tabs/:tabId – update a tab (optional)
exports.updateUserTab = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { tabId } = req.params;
    const { label, chatIds } = req.body;
    const tab = await UserTab.findOne({ where: { userId, tabId } });
    if (!tab) return res.status(404).json({ success: false, message: 'Tab not found' });
    await tab.update({ label, chatIds });
    res.json({ success: true, data: tab });
  } catch (err) {
    console.error('Error updating user tab', err);
    res.status(500).json({ success: false, message: 'Failed to update tab' });
  }
};

// DELETE /api/user/:id/tabs/:tabId – remove a tab
exports.deleteUserTab = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { tabId } = req.params;
    const deleted = await UserTab.destroy({ where: { userId, tabId } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Tab not found' });
    res.json({ success: true, message: 'Tab deleted' });
  } catch (err) {
    console.error('Error deleting user tab', err);
    res.status(500).json({ success: false, message: 'Failed to delete tab' });
  }
};
