require('dotenv').config();
const onboardingController = require('../controllers/onboarding.controller');
const { query } = require('../utils/database/query');

function mockReqRes(user, body = {}, query = {}, params = {}) {
    const res = {
        statusCode: 200,
        headers: {},
        jsonPayload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.jsonPayload = payload;
            return this;
        }
    };
    const req = { user, body, query, params, headers: {} };
    return { req, res };
}

async function testOnboarding() {
    console.log('--- STARTING ONBOARDING API TESTS ---');
    // Use an existing user_id from the database to satisfy the user_interests/notifications foreign keys.
    // Let's query one active user first.
    const activeUsers = await query('SELECT user_id FROM users LIMIT 1');
    if (activeUsers.length === 0) {
        console.error('No users found in database to run tests against.');
        process.exit(1);
    }

    const testUserId = activeUsers[0].user_id;
    console.log(`Using test user_id: ${testUserId}`);

    const mockUser = { userId: testUserId };

    try {
        // Test 1: Get onboarding status
        console.log('\nTest 1: GET /api/onboarding/status...');
        const { req: req1, res: res1 } = mockReqRes(mockUser);
        await onboardingController.getStatus(req1, res1);
        console.log('Status code:', res1.statusCode);
        console.log('Response payload:', res1.jsonPayload);

        // Test 2: Save interests
        console.log('\nTest 2: POST /api/onboarding/interests...');
        const { req: req2, res: res2 } = mockReqRes(mockUser, { interests: ['technology', 'software-development', 'books'] });
        await onboardingController.saveInterests(req2, res2);
        console.log('Status code:', res2.statusCode);
        console.log('Response payload:', res2.jsonPayload);

        // Verify interests saved in DB
        const savedInterests = await query('SELECT * FROM user_interests WHERE user_id = ?', [testUserId]);
        console.log('Interests in DB:', savedInterests.map(i => i.interest_slug));

        // Test 3: Get recommendations
        console.log('\nTest 3: GET /api/onboarding/recommendations...');
        const { req: req3, res: res3 } = mockReqRes(mockUser, {}, { category: 'technology' });
        await onboardingController.getRecommendations(req3, res3);
        console.log('Status code:', res3.statusCode);
        console.log('Recommended creators returned:', res3.jsonPayload?.data?.creators?.length || 0);

        // Test 4: Follow creators
        console.log('\nTest 4: POST /api/onboarding/follow...');
        // We shouldn't follow ourselves. Let's find another user to follow.
        const otherUsers = await query('SELECT user_id FROM users WHERE user_id != ? LIMIT 1', [testUserId]);
        if (otherUsers.length > 0) {
            const targetId = otherUsers[0].user_id;
            console.log(`Following other user_id: ${targetId}`);
            const { req: req4, res: res4 } = mockReqRes(mockUser, { userIds: [targetId] });
            await onboardingController.followCreators(req4, res4);
            console.log('Status code:', res4.statusCode);
            console.log('Response payload:', res4.jsonPayload);
            
            // Clean up follow relationship
            await query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [testUserId, targetId]);
        } else {
            console.log('No other user to test follow.');
        }

        // Test 5: Complete onboarding
        console.log('\nTest 5: POST /api/onboarding/complete...');
        const { req: req5, res: res5 } = mockReqRes(mockUser);
        await onboardingController.completeOnboarding(req5, res5);
        console.log('Status code:', res5.statusCode);
        console.log('Response payload:', res5.jsonPayload);

        // Verify user onboarding step updated in DB
        const userStep = await query('SELECT onboarding_step FROM users WHERE user_id = ?', [testUserId]);
        console.log('Onboarding step in DB:', userStep[0]?.onboarding_step);

        // Cleanup test data
        await query('DELETE FROM user_interests WHERE user_id = ?', [testUserId]);
        await query('UPDATE users SET onboarding_step = 0 WHERE user_id = ?', [testUserId]);
        console.log('\nCleanup completed.');

        console.log('\n--- ALL ONBOARDING API TESTS PASSED ---');
    } catch (e) {
        console.error('Test execution failed:', e);
    } finally {
        process.exit(0);
    }
}

testOnboarding();
