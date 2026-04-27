require('dotenv').config();
const pool = require('./config/database');
const crypto = require('crypto');

const SEED_CONFIG = {
    USER_COUNT: 20,
    POST_COUNT: 100,
    VIRAL_CHANCE: 0.1, // 10% chance for a viral post (>2000 comments)
    MEDIUM_CHANCE: 0.3, // 30% chance for medium post (120-2000 comments)
};

const CATEGORIES = ['Sports', 'Technology', 'Entertainment', 'Academic', 'Social'];
const CAPTIONS = [
    "Just finished an amazing workout! #gym #fitness",
    "Finally solved that bug in my React app. Coding is life. #developer #tech",
    "The sunset on campus today was breathtaking. #university #vibes",
    "Can't believe I finally finished this project. #academic #win",
    "Weekend getaway was much needed. #friends #fun",
    "Watching the game tonight. Who are you rooting for? #football #sports",
    "New setup finally arrived. Rate it! #setup #gaming",
    "Study session at the library. 5 cups of coffee in. #student #grind",
    "Anyone else excited for the new movie release? #cinema #hype",
    "Exploring hidden gems in the city. #explore #life"
];

const COMMENTS_POOL = [
    "This is actually clean",
    "Where did you shoot this?",
    "I need this setup",
    "Looks expensive but worth it",
    "Not what I expected but I like it",
    "This deserves more attention",
    "How did you edit this?",
    "Insane energy!",
    "Definitely trying this tomorrow.",
    "Can you share the link?",
    "W caption honestly",
    "Big moves only",
    "I'm inspired",
    "Wait, is this real?",
    "Love the lighting in this",
    "Absolute legend",
    "Facts.",
    "Goat behavior",
    "This is the way.",
    "Need more of this content"
];

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function generateEngagement() {
    const r = Math.random();
    let commentsCount;

    if (r < (1 - SEED_CONFIG.VIRAL_CHANCE - SEED_CONFIG.MEDIUM_CHANCE)) {
        commentsCount = rand(30, 120);
    } else if (r < (1 - SEED_CONFIG.VIRAL_CHANCE)) {
        commentsCount = rand(120, 2000);
    } else {
        commentsCount = rand(2000, 25000);
    }

    const likesCount = rand(commentsCount * 5, commentsCount * 25);
    const sharesCount = rand(
        Math.max(30, Math.floor(commentsCount * 0.2)),
        Math.min(500, Math.floor(commentsCount * 1.5))
    );

    return { commentsCount, likesCount, sharesCount };
}

async function seed() {
    try {
        console.log('--- STARTING HIGH-FIDELITY SEEDING (Algorithm 7.5 Ready) ---');

        // 1. Generate Seed Users
        const userIds = [];
        for (let i = 0; i < SEED_CONFIG.USER_COUNT; i++) {
            const userId = crypto.randomUUID();
            const username = `seed_user_${i}_${rand(100, 999)}`;
            const name = `Seed User ${i}`;
            await pool.query(
                `INSERT INTO users (user_id, name, username, email, password_hash, avatar_url, campus, is_seed) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, 
                    name,
                    username, 
                    `${username}@example.com`, 
                    '$2b$10$YourMockHashedPassword', // Realistic bcrypt mock
                    `https://picsum.photos/seed/${userId}/200`,
                    'Main Campus',
                    true
                ]
            );
            userIds.push(userId);
        }
        console.log(`Created ${SEED_CONFIG.USER_COUNT} seed users.`);

        // 2. Generate Posts & Deep Engagement
        for (let i = 0; i < SEED_CONFIG.POST_COUNT; i++) {
            const postId = crypto.randomUUID();
            const creatorId = userIds[rand(0, userIds.length - 1)];
            const engagement = generateEngagement();
            const postTime = new Date(Date.now() - rand(0, 72 * 60 * 60 * 1000)); // Spread over 72h
            const category = CATEGORIES[rand(0, CATEGORIES.length - 1)];

            // Create Post
            await pool.query(
                `INSERT INTO posts (post_id, user_id, content, media_url, media_type, post_type, campus, category, spark_count, comment_count, share_count, created_at, is_seed) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    postId,
                    creatorId,
                    CAPTIONS[rand(0, CAPTIONS.length - 1)],
                    `https://picsum.photos/seed/${postId}/800/600`,
                    'image',
                    'public',
                    'Main Campus',
                    category,
                    engagement.likesCount,
                    engagement.commentsCount,
                    engagement.sharesCount,
                    postTime,
                    true
                ]
            );

            // Create a few physical comments (limited for speed, but real)
            const physicalComments = Math.min(20, engagement.commentsCount);
            for (let j = 0; j < physicalComments; j++) {
                const commentId = crypto.randomUUID();
                const commenterId = userIds[rand(0, userIds.length - 1)];
                const commentTime = new Date(postTime.getTime() + rand(0, 48 * 60 * 60 * 1000));
                
                await pool.query(
                    `INSERT INTO comments (comment_id, post_id, user_id, content, created_at, is_seed) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        commentId,
                        postId,
                        commenterId,
                        COMMENTS_POOL[rand(0, COMMENTS_POOL.length - 1)],
                        commentTime,
                        true
                    ]
                );
            }

            // Create a few physical sparks (likes)
            const physicalLikes = Math.min(10, engagement.likesCount);
            for (let k = 0; k < physicalLikes; k++) {
                const sparkId = crypto.randomUUID();
                const likerId = userIds[rand(0, userIds.length - 1)];
                const sparkTime = new Date(postTime.getTime() + rand(0, 24 * 60 * 60 * 1000));
                
                // Use IGNORE to prevent unique constraint errors if same user likes twice in mock
                await pool.query(
                    `INSERT IGNORE INTO sparks (spark_id, post_id, user_id, created_at, is_seed) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        sparkId,
                        postId,
                        likerId,
                        sparkTime,
                        true
                    ]
                );
            }

            if ((i + 1) % 10 === 0) console.log(`Processed ${i + 1}/${SEED_CONFIG.POST_COUNT} posts...`);
        }

        console.log('--- SEEDING COMPLETE: DATABASE IS LIVE ---');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        process.exit();
    }
}

seed();
