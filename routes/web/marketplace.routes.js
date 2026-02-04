const express = require('express');
const router = express.Router();
const marketplaceController = require('../../controllers/marketplace.controller');
const { ejsAuthMiddleware } = require('../../middleware/auth.middleware');

router.get('/marketplace', ejsAuthMiddleware, marketplaceController.renderMarketplace);
router.get('/lost-found', ejsAuthMiddleware, marketplaceController.renderLostFound);
router.get('/skill-market', ejsAuthMiddleware, marketplaceController.renderSkillMarket);

module.exports = router;
