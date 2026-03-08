
require('dotenv').config();
const { query } = require('./utils/database/query');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function testSignup() {
    const userData = {
        name: 'Test User',
        username: 'testuser_' + Date.now(),
        email: 'test' + Date.now() + '@example.com',
        password: 'password123',
        campus: 'Test Campus',
        major: 'Testing',
        year: '1st Year'
    };

    console.log('--- Testing Signup ---');
    try {
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        const userId = crypto.randomUUID();

        await query(
            'INSERT INTO users (user_id, name, username, email, password_hash, campus, major, year_of_study) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, userData.name, userData.username, userData.email, hashedPassword, userData.campus, userData.major, userData.year]
        );
        console.log('✅ Signup query succeeded. User ID:', userId);
        return { userId, ...userData };
    } catch (error) {
        console.error('❌ Signup query failed:', error.message);
        return null;
    }
}

async function testLogin(username, password) {
    console.log('\n--- Testing Login ---');
    try {
        const [users] = await query(
            'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1',
            [username, username]
        );

        if (users.length === 0) {
            console.error('❌ Login failed: User not found');
            return;
        }

        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);
        
        if (match) {
            console.log('✅ Login succeeded for:', user.username);
        } else {
            console.error('❌ Login failed: Password mismatch');
        }
    } catch (error) {
        console.error('❌ Login query failed:', error.message);
    }
}

async function run() {
    const user = await testSignup();
    if (user) {
        await testLogin(user.username, user.password);
    }
    process.exit(0);
}

run();
