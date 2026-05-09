require('dotenv').config();
const pool = require('../config/database');
const crypto = require('crypto');

async function createMockPoll() {
    console.log('🚀 Creating Mock Poll...');
    
    try {
        // 1. Get some users to act as voters
        const [users] = await pool.query('SELECT user_id, name, username, avatar_url FROM users LIMIT 50');
        if (users.length < 5) {
            console.log('❌ Not enough users to create a good mock. Need at least 5.');
            process.exit(1);
        }

        const creator = users[0];
        const pollId = crypto.randomUUID();
        const campus = 'Sparkle University';
        const question = 'What is the best feature of the new Sparkle Hub? 💎';

        // 2. Insert Poll
        await pool.query(
            'INSERT INTO polls (poll_id, creator_id, question, campus, category, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [pollId, creator.user_id, question, campus, 'General', 0]
        );

        // 3. Insert Options
        const options = [
            { id: crypto.randomUUID(), text: 'Real-time Polls' },
            { id: crypto.randomUUID(), text: 'Participant Sheets' },
            { id: crypto.randomUUID(), text: 'Voter Avatars' },
            { id: crypto.randomUUID(), text: 'Mobile Responsive UI' }
        ];

        for (let i = 0; i < options.length; i++) {
            await pool.query(
                'INSERT INTO poll_options (option_id, poll_id, option_text, option_order, vote_count) VALUES (?, ?, ?, ?, 0)',
                [options[i].id, pollId, options[i].text, i]
            );
        }

        // 4. Insert Random Votes
        console.log(`🗳️ Simulating ${users.length} votes...`);
        for (const user of users) {
            const randomOption = options[Math.floor(Math.random() * options.length)];
            const voteId = crypto.randomUUID();

            await pool.query(
                'INSERT INTO poll_votes (vote_id, poll_id, option_id, user_id, voted_at) VALUES (?, ?, ?, ?, NOW())',
                [voteId, pollId, randomOption.id, user.user_id]
            );

            await pool.query(
                'UPDATE poll_options SET vote_count = vote_count + 1 WHERE option_id = ?',
                [randomOption.id]
            );

            await pool.query(
                'UPDATE polls SET total_votes = total_votes + 1 WHERE poll_id = ?',
                [pollId]
            );
        }

        console.log('✅ Mock Poll Created Successfully!');
        console.log(`🔗 ID: ${pollId}`);
        console.log(`❓ Question: ${question}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating mock poll:', err);
        process.exit(1);
    }
}

createMockPoll();
