const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const videoUrls = [
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1775330840142-287830f1",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1775330822270-d19ea8d7",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1775305301293-43e0d931",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1775324608349-f65f5c0f",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1775126391674-3c05dbb1",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1775049458747-a0798fed",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1775049368185-cb27d474",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1775067358719-ab98d249",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1775067228717-347be556",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1775048621195-d1c1275a",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1775048539718-4e3dcd72",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1774934977009-8ec1a942",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1774653467652-6352cd30",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1774639182837-6c338f6d",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1774620961408-da0f3ced",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1774516922364-65d5241e",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1774420595714-d886c557",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1774349629437-512ce1b0",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1774350712910-fa3c95d9",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1774222266976-2794d5f2",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_messages/msg-1774220910306-07b6d2b4",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1774102321364-b2b6205d",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773696448389-16ab7abd",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773494270269",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773406855670",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773388899564",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773245170324",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773245144877",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773245123752",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773245064678",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773209000196",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773161569515",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773159899705",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1773040503313",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1771711848019",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1771661847930",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1770041009601",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1770024376330",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1770010766574",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1769872104342",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/sparkle_uploads/media-1769600734371",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/samples/elephants",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/samples/cld-sample-video",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/samples/dance-2",
  "https://res.cloudinary.com/drwldeniw/video/upload/v1/samples/sea-turtle"
];

const captions = [
    "Late night signal ⚡ #sparkle #vibes",
    "Campus frequencies hitting different today 🎧 #university #life",
    "Unfiltered moment from the village 🌿 #sparkle #original",
    "Broadcasting my energy into the orbit 🛰️ #sync #spark",
    "Synchronized with the village pulse 💖 #sparkle #community",
    "Captured this light leak ✨ #aesthetic #moments",
    "Dancing through the digital noise 💃 #energy #spark",
    "Signal strength: 100% 🚀 #sparkle #broadcast",
    "Lost in the frequency 🎶 #music #spark",
    "Sharing a piece of my orbit 🌌 #sparkle #universe"
];

const categories = ['lifestyle', 'entertainment', 'music', 'dance', 'nature', 'university', 'fashion', 'tech'];

async function seed() {
    console.log('🚀 Starting Cloudinary Video Seeding...');
    
    // DB_SSL handling
    const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : null;

    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: ssl
    });

    try {
        const [users] = await pool.query('SELECT user_id, username FROM users LIMIT 10');
        if (users.length === 0) {
            console.error('❌ No users found. Seed users first!');
            return;
        }

        console.log('🧹 Clearing specific moments to prevent duplicates...');
        await pool.query("DELETE FROM moments WHERE media_url LIKE '%cloudinary.com%'");

        console.log(`🌊 Found ${users.length} users. Preparing to seed ${videoUrls.length} moments...`);

        for (let i = 0; i < videoUrls.length; i++) {
            const user = users[i % users.length];
            const momentId = uuidv4();
            const caption = captions[i % captions.length];
            
            // Add extension for better browser detection
            const rawUrl = videoUrls[i];
            const mediaUrl = rawUrl.includes('.') ? rawUrl : `${rawUrl}.mp4`;
            
            const category = categories[i % categories.length];

            await pool.query(
                `INSERT INTO moments (moment_id, user_id, caption, media_url, media_type, category, like_count, comment_count, share_count, created_at) 
                 VALUES (?, ?, ?, ?, 'video', ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? HOUR))`,
                [
                    momentId, 
                    user.user_id, 
                    caption, 
                    mediaUrl, 
                    'video', // media_type explicitly 'video'
                    category, 
                    Math.floor(Math.random() * 100), 
                    Math.floor(Math.random() * 20), 
                    Math.floor(Math.random() * 10),
                    i 
                ]
            );

            // Seed a hashtag or two
            const tags = caption.match(/#[a-zA-Z0-9_]+/g) || [];
            for (const tag of tags) {
                await pool.query('INSERT INTO moment_hashtags (moment_id, hashtag) VALUES (?, ?)', [momentId, tag.toLowerCase()]);
            }
        }

        console.log(`✅ Successfully seeded ${videoUrls.length} Cloudinary moments with Extensions!`);

    } catch (err) {
        console.error('❌ Seeding failed:', err);
    } finally {
        await pool.end();
    }
}

seed();
