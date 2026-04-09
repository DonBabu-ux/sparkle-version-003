const mysql = require('mysql2/promise');
require('dotenv').config();

const videos = [
  "https://player.vimeo.com/external/371433846.sd.mp4?s=231da751f7d1421710972410f92ec5d2b7b5f818&profile_id=139&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/373539827.sd.mp4?s=9e9e1c28c8c5c7d0e4d9b6c0c8c5c7d0e4d9b6c0&profile_id=139&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/494252666.sd.mp4?s=722883042c75a4dc44c356345ec4824d7735165c&profile_id=165&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/459389137.sd.mp4?s=82c2196695273b75439c2f6d0a797c2719c81a54&profile_id=165&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/391034444.sd.mp4?s=70a2f4fa8674d8b991ef259659b8eb7c52a0a256&profile_id=165&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/494252666.sd.mp4?s=722883042c75a4dc44c356345ec4824d7735165c&profile_id=165&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/517090025.sd.mp4?s=f7394d216d1f03f39389e909a3f2b6e156475630&profile_id=165&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/403421743.sd.mp4?s=910c2c10b40a3203f56d95368a3243147814b314&profile_id=165&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/482705494.sd.mp4?s=6b1a3e6f966158d69f067d266e7b16568c0b561b&profile_id=165&oauth2_token_id=57447761",
  "https://player.vimeo.com/external/363821033.sd.mp4?s=92c2196695273b75439c2f6d0a797c2719c81a54&profile_id=165&oauth2_token_id=57447761"
];

const titles = [
  "Late night study vibes 📚",
  "Campus sunset is unmatched 🌅",
  "Gym gains at the student center 💪",
  "Java programming or Java coffee? ☕",
  "Engineering building is a maze 🏗️",
  "Secret rooftop spot 🤫",
  "Graduation season is here! 🎓",
  "Soccer practice under the lights ⚽",
  "Dance club practicing in the lobby 💃",
  "Pizza night with the roomies 🍕"
];

const usernames = ["student_life", "campus_explorer", "tech_wizard", "sparkle_official", "uon_vibes", "ku_chronicles", "mojo_rising", "daystar_daily"];

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  console.log('Fetching users and seeding 100 moments...');

  const [users] = await connection.execute('SELECT user_id FROM users LIMIT 10');
  
  if (users.length === 0) {
    console.error('No users found to associate moments with!');
    await connection.end();
    return;
  }

  for (let i = 0; i < 100; i++) {
    const videoUrl = videos[Math.floor(Math.random() * videos.length)];
    const title = titles[Math.floor(Math.random() * titles.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const views = Math.floor(Math.random() * 5000) + 100;
    const likes = Math.floor(Math.random() * views / 2);
    const momentId = require('uuid').v4();

    await connection.execute(
      `INSERT INTO moments (moment_id, user_id, caption, media_url, media_type, view_count, like_count, created_at) 
       VALUES (?, ?, ?, ?, 'video', ?, ?, NOW())`,
      [momentId, user.user_id, title, videoUrl, views, likes]
    );
  }

  console.log('Successfully seeded 100 moments! ✨');
  await connection.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
});
