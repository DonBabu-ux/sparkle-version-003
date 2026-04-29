const mysql = require('mysql2/promise');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

async function addTikTok() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  console.log('Adding TikTok moment...');

  // Get a random user to associate with
  const [users] = await connection.execute('SELECT user_id FROM users LIMIT 1');
  
  if (users.length === 0) {
    console.error('No users found to associate the moment with!');
    await connection.end();
    return;
  }

  const userId = users[0].user_id;
  const momentId = uuidv4();
  const tiktokUrl = 'https://www.tiktok.com/@beautifulbabies23/video/7617283765030636830';
  const caption = 'Baby very lucky ❤️😚 for love papa 💘 #cuteepai #motherhood #viral #babyshower #momlife';
  
  await connection.execute(
    `INSERT INTO moments (moment_id, user_id, caption, media_url, media_type, view_count, like_count, created_at) 
     VALUES (?, ?, ?, ?, 'video', ?, ?, NOW())`,
    [momentId, userId, caption, tiktokUrl, 5240, 1280]
  );

  console.log('Successfully added the TikTok moment! ✨');
  console.log('Moment ID:', momentId);
  await connection.end();
}

addTikTok().catch(err => {
  console.error('Failed to add TikTok moment:', err);
});
