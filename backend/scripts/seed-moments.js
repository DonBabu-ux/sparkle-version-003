require('dotenv').config();
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    console.log('🚀 Starting Seed Moments script...');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_NAME:', process.env.DB_NAME);

    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('🌱 Seeding Moments...');

        // 1. Get some real users
        const [users] = await pool.query('SELECT user_id, username FROM users LIMIT 5');
        if (users.length === 0) {
            console.error('❌ No users found to associate moments with. Please create some users first.');
            return;
        }

        const videoLinks = [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Subtle_Pointers_720p_Clip.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
        ];

        // Clear existing moments for clean state
        console.log('🧹 Clearing existing moments and hashtags...');
        await pool.query('DELETE FROM moment_hashtags');
        await pool.query('DELETE FROM moment_likes');
        await pool.query('DELETE FROM saved_moments');
        await pool.query('DELETE FROM moments');

        const captions = [
            'Dancing through the night! 💃 #neon #vibes',
            'Nightclub energy is unmatched ✨ #party #dance',
            'Lost in the music 🎶 #clubbing #afterglow',
            'Stage lights hitting different ⚡ #performance #spark',
            'Midnight moves 🌙 #dance #freestyle',
            'Neon dreams come true 🌈 #aesthetic #glow',
            'Smooth skating at golden hour 🛹 #skate #chill',
            'Waves of serenity 🌊 #beach #nature',
            'City lights and late nights 🏙️ #urban #traffic',
            'Lighting up the sky! 🎆 #celebration #fireworks'
        ];

        const categories = ['entertainment', 'lifestyle', 'entertainment', 'music', 'dance', 'lifestyle', 'sports', 'nature', 'lifestyle', 'entertainment'];

        // Clear existing moments if needed (optional, but keep it for clean seed)
        // await pool.query('DELETE FROM moments');

        for (let i = 0; i < 10; i++) {
            const user = users[i % users.length];
            const momentId = uuidv4();
            const caption = captions[i];
            const mediaUrl = videoLinks[i];
            const category = categories[i];

            await pool.query(
                `INSERT INTO moments (moment_id, user_id, caption, media_url, media_type, category, like_count, comment_count, share_count, created_at) 
                 VALUES (?, ?, ?, ?, 'video', ?, ?, ?, ?, NOW())`,
                [momentId, user.user_id, caption, mediaUrl, category, Math.floor(Math.random() * 50), Math.floor(Math.random() * 10), Math.floor(Math.random() * 5)]
            );

            // Seed some hashtags
            const tags = caption.match(/#[a-zA-Z0-9_]+/g) || [];
            for (const tag of tags) {
                await pool.query('INSERT INTO moment_hashtags (moment_id, hashtag) VALUES (?, ?)', [momentId, tag.toLowerCase()]);
            }

            console.log(`✅ Seeded moment ${i + 1} by @${user.username}`);
        }

        console.log('✨ Seeding complete!');

    } catch (err) {
        console.error('❌ Seeding failed:', err);
    } finally {
        await pool.end();
    }
}

seed();
