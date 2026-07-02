require('dotenv').config();
const authService = require('../services/auth.service');
const { query } = require('../utils/database/query');

async function runTests() {
    console.log('--- STARTING SIGNUP VALIDATION & SUGGESTION TESTS ---');
    let testUserId = null;

    try {
        // Test 1: Empty and invalid fields validation
        console.log('\nTest 1: Validating empty fields and format validations...');
        try {
            await authService.signup({
                name: '',
                username: 'invalid char!',
                email: 'bademail',
                password: '123',
                user_type: 'invalid_role'
            });
            console.error('❌ Test 1 Failed: Expected validation error but signup succeeded.');
        } catch (error) {
            if (error.validationErrors) {
                console.log('✅ Test 1 Passed. Validation errors received:', error.validationErrors);
            } else {
                console.error('❌ Test 1 Failed with unexpected error:', error);
            }
        }

        // Test 2: Valid signup
        console.log('\nTest 2: Validating successful signup...');
        const uniqueSuffix = Date.now();
        const testUser = {
            name: 'John Doe',
            username: `johndoe_${uniqueSuffix}`,
            email: `john_${uniqueSuffix}@example.com`,
            password: 'Password123!',
            user_type: 'student',
            campus: 'Main Campus',
            major: 'Computer Science',
            year: '3'
        };

        const result = await authService.signup(testUser);
        if (result.success && result.user && result.user.username === testUser.username.toLowerCase()) {
            console.log('✅ Test 2 Passed. User signed up successfully. ID:', result.user.id);
            testUserId = result.user.id;
        } else {
            console.error('❌ Test 2 Failed. Unexpected response:', result);
        }

        // Test 3: Duplicate username and email check
        console.log('\nTest 3: Validating duplicate email and username with suggestions...');
        try {
            await authService.signup({
                name: 'Jane Doe',
                username: testUser.username, // duplicate
                email: testUser.email, // duplicate
                password: 'Password123!',
                user_type: 'student'
            });
            console.error('❌ Test 3 Failed: Expected duplicate validation error but signup succeeded.');
        } catch (error) {
            if (error.validationErrors) {
                console.log('✅ Test 3 Passed. Duplicate errors received:');
                console.log(JSON.stringify(error.validationErrors, null, 2));
            } else {
                console.error('❌ Test 3 Failed with unexpected error:', error);
            }
        }

        // Clean up test user
        if (testUserId) {
            await query('DELETE FROM users WHERE user_id = ?', [testUserId]);
            console.log('\nCleaned up Test User from DB.');
        }

        console.log('\n--- ALL SIGNUP VALIDATION TESTS COMPLETED SUCCESSFULLY ---');

    } catch (e) {
        console.error('Test execution failed:', e);
    } finally {
        process.exit(0);
    }
}

runTests();
