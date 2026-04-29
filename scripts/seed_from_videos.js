const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function seedFromVideosFile() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  console.log('Reading videos.json...');
  const filePath = path.join(__dirname, '..', 'videos.json');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim().startsWith('<blockquote'));

  console.log(`Found ${lines.length} videos to seed.`);

  // Get users for association
  const [users] = await connection.execute('SELECT user_id FROM users LIMIT 20');
  if (users.length === 0) {
    console.error('No users found in database. Please seed users first.');
    await connection.end();
    return;
  }

  const categories = ['lifestyle', 'tech', 'comedy', 'politics', 'education', 'viral'];

  for (const line of lines) {
    try {
      // Simple regex extraction
      const citeMatch = line.match(/cite="([^"]+)"/);
      const url = citeMatch ? citeMatch[1] : null;
      
      if (!url) continue;

      // Extract caption - look for text inside <section> after the first </a>
      // This is a bit brittle but should work for the provided format
      let caption = '';
      const sectionMatch = line.match(/<section>.*?<\/a>(.*?)<a/);
      if (sectionMatch) {
        caption = sectionMatch[1].trim();
      } else {
        // Fallback: get everything between first </a> and second </a> or </section>
        const fallbackMatch = line.match(/<section>.*?<\/a>(.*?)<\/section>/);
        if (fallbackMatch) {
            caption = fallbackMatch[1].replace(/<[^>]*>/g, '').trim();
        }
      }

      // Cleanup caption from extra whitespace and tags
      caption = caption.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      
      const userId = users[Math.floor(Math.random() * users.length)].user_id;
      const momentId = uuidv4();
      const category = categories[Math.floor(Math.random() * categories.length)];
      const views = Math.floor(Math.random() * 10000) + 500;
      const likes = Math.floor(Math.random() * views / 3);
      const comments = Math.floor(Math.random() * likes / 10);

      // Check if this URL already exists to avoid duplicates
      const [existing] = await connection.execute('SELECT moment_id FROM moments WHERE media_url = ?', [url]);
      if (existing.length > 0) {
        console.log(`Skipping duplicate: ${url}`);
        continue;
      }

      await connection.execute(
        `INSERT INTO moments (moment_id, user_id, caption, media_url, media_type, category, view_count, like_count, comment_count, created_at) 
         VALUES (?, ?, ?, ?, 'video', ?, ?, ?, ?, NOW())`,
        [momentId, userId, caption || 'Sparkle Moment', url, category, views, likes, comments]
      );

      console.log(`Seeded: ${url.split('/').pop()}`);
    } catch (err) {
      console.error('Error seeding line:', err.message);
    }
  }

  console.log('Seeding complete! ✨');
  await connection.end();
}

seedFromVideosFile().catch(err => {
  console.error('Seeding failed:', err);
});
