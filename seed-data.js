require('dotenv').config();
const pool = require('./config/database');
const crypto = require('crypto');

// ==========================================
// 1. SIMULATION SETTINGS
// ==========================================
const SEED_CONFIG = {
    USER_COUNT: 45, // 30-50 users
    POST_COUNT: 280, // 250-300 posts
    MAX_PHYSICAL_COMMENTS: 150, // Limit physical rows to prevent dev DB bloat
    MAX_PHYSICAL_LIKES: 100 
};

// ==========================================
// 2. REALISTIC LANGUAGE POOLS (Sheng + English)
// ==========================================
const shengNouns = ["ngoma", "picha", "video", "stori", "form", "mboka", "msee", "dem", "vibe"];
const shengAdjs = ["noma", "moto", "fiti", "safi", "mbaya", "wazimu", "clean", "wild", "crazy", "hard"];
const actions = ["watching this", "listening to this", "looking at this", "doing this", "vibing to this"];
const questions = ["ni mimi tu", "mwingine ameona hii", "mnaona nini", "ni ukweli"];

function randWord(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

const captionPatterns = [
    () => `hii ${randWord(shengNouns)} imeenda 🔥`,
    () => `not me ${randWord(actions)} 😭`,
    () => `kwani ${randWord(questions)}?`,
    () => `this is actually ${randWord(shengAdjs)}`,
    () => `si mchezo bana 😂`,
    () => `wueh this is ${randWord(shengAdjs)}`,
    () => `hii ni ${randWord(shengAdjs)} 👏`,
    () => `nani mwingine ameona hii?`,
    () => `kama kawaida mko juu 🔥`,
    () => `lowkey this is ${randWord(shengAdjs)}`,
    () => `mbona niko obsessed na hii 😭`,
    () => `this didn't have to go this hard`
];

// ~150-300 Base Phrases combined in categories
const shortReactions = ["wueh", "dead 😂", "yo???", "nahh 😭", "aiii", "yoo", "damn", "fr", "💀💀"];
const emojisOnly = ["🔥🔥🔥", "😭😭", "😂😂😂", "💀", "👏", "🙌", "👀", "🔥", "💯"];
const mixedLanguage = [
    "hii ni noma 😂",
    "bro alisema nini hapo 😭",
    "kwani ni mimi tu naona hii?",
    "this is actually wild btw",
    "si mchezo bana",
    "hii imeenda vibaya sana 😭",
    "kama kawaida",
    "wueh sijatarajia hii",
    "hii imenimaliza 😂",
    "bana this is too good"
];
const realSentences = [
    "this is actually better than most content I’ve seen here",
    "hii ilinihit hard not gonna lie",
    "why is no one talking about this part 😂",
    "I've been replaying this for the last 10 minutes",
    "They really outdid themselves this time",
    "Can someone explain the context to me?",
    "This deserves way more views honestly"
];
const replies = ["😂😂 kweli", "exactly!", "umesema ukweli", "I noticed that too!", "facts", "kabisa", "nah fr", "100%"];

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function generateCaption() {
    return randWord(captionPatterns)();
}

function generateCommentText() {
    const r = Math.random() * 100;
    // Comment Types Distribution:
    // Short reactions: 40%, Emojis: 20%, Mixed Swahili-English: 20%, Real sentences: 15%, Replies: 5%
    if (r < 40) return randWord(shortReactions);
    if (r < 60) return randWord(emojisOnly);
    if (r < 80) return randWord(mixedLanguage);
    if (r < 95) return randWord(realSentences);
    return randWord(replies);
}

function getEngagementProfile() {
    const r = Math.random();
    // 5% viral, 20% high, 50% medium, 25% low
    if (r < 0.05) {
        // High likes, high comments OR high likes, low comments (imperfect realism)
        const isCommentHeavy = Math.random() > 0.5;
        return {
            likesCount: rand(80000, 180000),
            commentsCount: isCommentHeavy ? rand(2000, 4500) : rand(900, 1500),
            sharesCount: rand(5000, 20000),
            tier: 'viral'
        };
    }
    if (r < 0.25) {
        return {
            likesCount: rand(10000, 50000),
            commentsCount: rand(200, 900),
            sharesCount: rand(1000, 4000),
            tier: 'high'
        };
    }
    if (r < 0.75) {
        return {
            likesCount: rand(1000, 8000),
            commentsCount: rand(20, 180),
            sharesCount: rand(50, 500),
            tier: 'medium'
        };
    }
    return {
        likesCount: rand(50, 800),
        commentsCount: rand(2, 20),
        sharesCount: rand(0, 30),
        tier: 'low'
    };
}

// Generate a random timestamp within the last 3 days
// Heavily weighted towards recent times for a "live" feel
function generateSpreadTimestamp() {
    const now = Date.now();
    const r = Math.random();
    let offsetMs = 0;
    
    if (r < 0.2) offsetMs = rand(1 * 60 * 1000, 60 * 60 * 1000); // 1 min to 1 hr ago
    else if (r < 0.5) offsetMs = rand(1 * 60 * 60 * 1000, 12 * 60 * 60 * 1000); // 1 to 12 hrs ago
    else if (r < 0.8) offsetMs = rand(12 * 60 * 60 * 1000, 48 * 60 * 60 * 1000); // 12 to 48 hrs ago
    else offsetMs = rand(48 * 60 * 60 * 1000, 72 * 60 * 60 * 1000); // 48 to 72 hrs ago

    return new Date(now - offsetMs);
}

// ==========================================
// 4. MAIN SEEDER LOGIC
// ==========================================
async function seed() {
    try {
        console.log('--- STARTING SOCIAL GRAPH SIMULATION SEEDER ---');
        console.log('Mode: Kenyan/Sheng Audience Realism');

        // Check if `is_seed` exists in the users table first, gracefully handle if not.
        // We'll wrap insertions in a try-catch to ensure robustness.
        
        // 1. Generate Seed Users
        const userIds = [];
        const userInsertions = [];
        for (let i = 0; i < SEED_CONFIG.USER_COUNT; i++) {
            const userId = crypto.randomUUID();
            const username = `seed_user_${i}_${rand(1000, 9999)}`;
            const name = `Simulated User ${i}`;
            const joinedAt = generateSpreadTimestamp();

            userInsertions.push(
                pool.query(
                    `INSERT INTO users (user_id, name, username, email, password_hash, avatar_url, campus, joined_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId, 
                        name,
                        username, 
                        `${username}@example.com`, 
                        '$2b$10$YourMockHashedPassword', // bcrypt mock
                        `https://picsum.photos/seed/${userId}/200`,
                        'Main Campus',
                        joinedAt
                    ]
                )
            );
            userIds.push(userId);
        }
        
        await Promise.all(userInsertions);
        console.log(`✅ Generated ${SEED_CONFIG.USER_COUNT} living users.`);

        // 2. Generate Posts & Realistic Engagement
        let postCounter = 0;
        const categories = ['Sports', 'Technology', 'Entertainment', 'Academic', 'Social'];

        for (let i = 0; i < SEED_CONFIG.POST_COUNT; i++) {
            const postId = crypto.randomUUID();
            const creatorId = userIds[rand(0, userIds.length - 1)];
            const engagement = getEngagementProfile();
            const postTime = generateSpreadTimestamp();
            const category = randWord(categories);

            // Create Post
            await pool.query(
                `INSERT INTO posts (post_id, user_id, content, media_url, media_type, post_type, campus, spark_count, comment_count, share_count, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    postId,
                    creatorId,
                    generateCaption(),
                    `https://picsum.photos/seed/${postId}/800/600`,
                    'image',
                    'public',
                    'Main Campus',
                    engagement.likesCount,      // Display numbers are massive
                    engagement.commentsCount,   // Display numbers are massive
                    engagement.sharesCount,
                    postTime
                ]
            );

            // Create physical comments (Batched for speed, capped to prevent infinite runs, simulated human behavior)
            const numPhysicalComments = Math.min(engagement.commentsCount, SEED_CONFIG.MAX_PHYSICAL_COMMENTS);
            if (numPhysicalComments > 0) {
                const commentValues = [];
                for (let j = 0; j < numPhysicalComments; j++) {
                    const commentId = crypto.randomUUID();
                    const commenterId = userIds[rand(0, userIds.length - 1)];
                    // Threading simulation: ~5% chance of being a reply
                    const isReply = Math.random() < 0.05 && commentValues.length > 0;
                    const parentId = isReply ? commentValues[rand(0, commentValues.length - 1)][0] : null;
                    
                    const commentTime = new Date(postTime.getTime() + rand(60000, 12 * 60 * 60 * 1000));

                    commentValues.push([
                        commentId,
                        postId,
                        commenterId,
                        parentId,
                        generateCommentText(),
                        commentTime
                    ]);
                }

                // Execute Bulk Insert for Comments
                await pool.query(
                    `INSERT INTO comments (comment_id, post_id, user_id, parent_comment_id, content, created_at) VALUES ?`,
                    [commentValues]
                );
            }

            // Create physical sparks (Batched)
            const numPhysicalSparks = Math.min(engagement.likesCount, SEED_CONFIG.MAX_PHYSICAL_LIKES);
            if (numPhysicalSparks > 0) {
                const sparkValues = [];
                // Use a Set to ensure we don't try to have the same user like the same post physically twice
                const likedUsers = new Set();
                
                let attempts = 0;
                while (sparkValues.length < numPhysicalSparks && attempts < SEED_CONFIG.MAX_PHYSICAL_LIKES * 2) {
                    const likerId = userIds[rand(0, userIds.length - 1)];
                    if (!likedUsers.has(likerId)) {
                        likedUsers.add(likerId);
                        const sparkId = crypto.randomUUID();
                        const sparkTime = new Date(postTime.getTime() + rand(60000, 24 * 60 * 60 * 1000));
                        sparkValues.push([
                            sparkId,
                            postId,
                            likerId,
                            sparkTime
                        ]);
                    }
                    attempts++;
                }

                if (sparkValues.length > 0) {
                    await pool.query(
                        `INSERT IGNORE INTO sparks (spark_id, post_id, user_id, created_at) VALUES ?`,
                        [sparkValues]
                    );
                }
            }

            postCounter++;
            if (postCounter % 20 === 0) {
                console.log(`⏳ Processed ${postCounter}/${SEED_CONFIG.POST_COUNT} posts...`);
            }
        }

        console.log('✅ POSTS AND ENGAGEMENT GENERATED.');
        console.log('--- SOCIAL GRAPH SIMULATION COMPLETE: PLATFORM IS NOW ALIVE ---');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        process.exit();
    }
}

seed();

