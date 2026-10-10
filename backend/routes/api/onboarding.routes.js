// routes/api/onboarding.routes.js
const express = require('express');
const router = express.Router();
const onboardingController = require('../../controllers/onboarding.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// All onboarding endpoints require the user to be authenticated
router.use(authMiddleware);

router.get('/status', onboardingController.getStatus);
router.get('/popular-users', onboardingController.getPopularUsers);
router.get('/recommendations', onboardingController.getRecommendations);
router.post('/follow', onboardingController.followCreators);
router.post('/interests', onboardingController.saveInterests);
router.post('/complete', onboardingController.completeOnboarding);

module.exports = router;
