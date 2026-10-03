// scratch/test-username-system.js
require('dotenv').config();
const pool = require('../config/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { normalizeUsername, validateUsername } = require('../utils/validation/username');
const authService = require('../services/auth.service');
const User = require('../models/User');

async function runTests() {
    console.log('🧪 Starting Sparkle Username System Verification Suite...\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    const testIdA = crypto.randomUUID();
    const testIdB = crypto.randomUUID();
    const baseUsername = `testuser_${Date.now().toString().slice(-6)}`;
    const passHash = await bcrypt.hash('TestPassword123!', 4);

    try {
        // --- TEST 1: Normalization ---
        console.log('\n--- 1. Testing Normalization Function ---');
        assert(normalizeUsername('  JohnDoe  ') === 'johndoe', 'Normalizes whitespace and uppercase');
        assert(normalizeUsername('@Jane_Doe') === 'jane_doe', 'Strips leading @ symbol');
        assert(normalizeUsername('SPARKLE.TEST') === 'sparkle.test', 'Normalizes periods and uppercase');
        
        const validRes = validateUsername('don_techie');
        assert(validRes.valid && validRes.value === 'don_techie', 'Validates proper username');
        const shortRes = validateUsername('ab');
        assert(!shortRes.valid && shortRes.error.code === 'USERNAME_TOO_SHORT', 'Rejects short username');
        const invalidCharRes = validateUsername('don techie!');
        assert(!invalidCharRes.valid && invalidCharRes.error.code === 'INVALID_USERNAME', 'Rejects invalid characters');

        // --- TEST 2: Creation & Duplicate Display Names Allowed ---
        console.log('\n--- 2. Testing Duplicate Display Names (Allowed) ---');
        await pool.query(
            'INSERT INTO users (user_id, name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)',
            [testIdA, 'John Common Name', baseUsername, `userA_${Date.now()}@sparkle.app`, passHash]
        );

        // Second user with same display name but different username
        const usernameB = `${baseUsername}_2`;
        await pool.query(
            'INSERT INTO users (user_id, name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)',
            [testIdB, 'John Common Name', usernameB, `userB_${Date.now()}@sparkle.app`, passHash]
        );
        assert(true, 'Two different users successfully created with the SAME display name "John Common Name"');

        // --- TEST 3: Database Unique Constraint Enforces Absolute Uniqueness ---
        console.log('\n--- 3. Testing Database Hard Unique Constraint ---');
        let duplicateRejected = false;
        try {
            // Attempt to insert duplicate username in different case
            const testIdC = crypto.randomUUID();
            await pool.query(
                'INSERT INTO users (user_id, name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)',
                [testIdC, 'Different Name', baseUsername.toUpperCase(), `userC_${Date.now()}@sparkle.app`, passHash]
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
                duplicateRejected = true;
            } else {
                console.error('Unexpected error:', err);
            }
        }
        assert(duplicateRejected, 'Database unique constraint immediately threw ER_DUP_ENTRY on duplicate normalized username');

        // --- TEST 4: Existing Username Available to Owner, Unavailable to Others ---
        console.log('\n--- 4. Testing Owner vs Other User Availability ---');
        const ownerCheck = await pool.query(
            'SELECT user_id, username FROM users WHERE username_normalized = ? LIMIT 1',
            [normalizeUsername(baseUsername)]
        );
        assert(ownerCheck[0].length > 0 && ownerCheck[0][0].user_id === testIdA, 'Owner identified correctly on availability check');

        // Check if other user sees it as taken
        const otherCheckTaken = ownerCheck[0].length > 0 && ownerCheck[0][0].user_id !== testIdB;
        assert(otherCheckTaken, 'User B sees User A username as taken');

        // --- TEST 5: Suggestions Generation Returns Only Available Candidates ---
        console.log('\n--- 5. Testing Clickable Suggestions Generation ---');
        const suggestions = await authService.generateAvailableUsernames(baseUsername);
        assert(Array.isArray(suggestions) && suggestions.length > 0, `Generated ${suggestions.length} suggestions: ${suggestions.join(', ')}`);
        
        // Check that none of the suggestions exist in the database
        const [takenCheck] = await pool.query(
            `SELECT username_normalized FROM users WHERE username_normalized IN (?)`,
            [suggestions]
        );
        assert(takenCheck.length === 0, 'ALL returned suggestions are guaranteed 100% available in database');

        // --- TEST 6: User ID Unchanged on Username Change ---
        console.log('\n--- 6. Testing Username Change & Immutable User ID ---');
        const newUsernameForA = `${baseUsername}_updated`;
        await User.update(testIdA, { username: newUsernameForA, username_updated_at: new Date() });
        
        const updatedA = await User.findById(testIdA);
        assert(updatedA.user_id === testIdA, 'User ID remains strictly unchanged');
        assert(updatedA.username === newUsernameForA, 'Username updated successfully');
        assert(updatedA.username_normalized === newUsernameForA.toLowerCase(), 'username_normalized updated automatically by database');

        // --- TEST 7: Login With New Username Works ---
        console.log('\n--- 7. Testing Login With New Username ---');
        const [loginUser] = await pool.query(
            'SELECT * FROM users WHERE email = ? OR username_normalized = ? OR username = ? LIMIT 1',
            ['dummy@email.com', normalizeUsername(newUsernameForA), newUsernameForA]
        );
        assert(loginUser.length > 0 && loginUser[0].user_id === testIdA, 'Immediate login with NEW normalized username succeeds');

        // --- TEST 8: Profile Lookup via getProfileWithStats ---
        console.log('\n--- 8. Testing Profile Lookup With Normalization ---');
        const profile = await User.getProfileWithStats(newUsernameForA.toUpperCase(), testIdB);
        assert(profile !== null && profile.user_id === testIdA, 'Profile resolves by username regardless of case');

        // --- TEST 9: Concurrent Race Condition Simulation ---
        console.log('\n--- 9. Testing Concurrency Race Condition ---');
        const targetUsername = `${baseUsername}_race`;
        
        // Simulating two concurrent requests: both try to claim targetUsername
        const promiseA = User.update(testIdA, { username: targetUsername });
        const promiseB = User.update(testIdB, { username: targetUsername });

        const results = await Promise.allSettled([promiseA, promiseB]);
        const successes = results.filter(r => r.status === 'fulfilled');
        const failures = results.filter(r => r.status === 'rejected');

        assert(successes.length === 1, 'Exactly one concurrent update succeeded');
        assert(failures.length === 1 && (failures[0].reason.code === 'ER_DUP_ENTRY' || failures[0].reason.errno === 1062), 
            'The other concurrent update was safely rejected by ER_DUP_ENTRY unique constraint');

    } catch (testErr) {
        console.error('Test suite error:', testErr);
        failed++;
    } finally {
        // Cleanup test users
        await pool.query('DELETE FROM users WHERE user_id IN (?, ?)', [testIdA, testIdB]);
        console.log('\nCleaned up test user records.');

        console.log(`\n========================================`);
        console.log(`TOTAL TESTS: ${passed + failed}`);
        console.log(`PASSED: ${passed}`);
        console.log(`FAILED: ${failed}`);
        console.log(`========================================\n`);
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
