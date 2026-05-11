const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

// Pexels API Key — add PEXELS_API_KEY=yourkey to your .env file
// Get a free key at: https://www.pexels.com/api/
const API_KEY = process.env.PEXELS_API_KEY;

if (!API_KEY) {
  console.error("❌  Error: PEXELS_API_KEY is missing in .env file.");
  console.log("   Get a free key at: https://www.pexels.com/api/");
  process.exit(1);
}

const searchTerms = [
  "people",
  "nature",
  "city",
  "campus",
  "music",
  "cars",
  "football",
  "fashion",
  "travel",
  "technology"
];

async function fetchVideos() {
  console.log("🎬  Starting Pexels video fetch...\n");
  let collected = [];

  for (const term of searchTerms) {
    console.log(`   → Fetching: "${term}"`);
    for (let page = 1; page <= 4; page++) {
      try {
        const res = await axios.get(
          `https://api.pexels.com/videos/search?query=${term}&per_page=20&page=${page}`,
          {
            headers: { Authorization: API_KEY }
          }
        );

        const videos = res.data.videos.map(v => {
          const file = v.video_files.find(f => f.quality === "sd") || v.video_files[0];
          return {
            caption: `${term} moment`,
            mediaUrl: file.link,
            mediaType: "video",
            category: term,
            duration: v.duration,
            views: Math.floor(Math.random() * 10000),
            likes: Math.floor(Math.random() * 2000),
            comments: Math.floor(Math.random() * 200),
            createdAt: new Date(Date.now() - Math.floor(Math.random() * 100000000)),
            userId: `seed_user_${Math.floor(Math.random() * 30)}`
          };
        });

        collected.push(...videos);
        process.stdout.write(`     page ${page}/4 — total so far: ${collected.length}\r`);

        // Respect Pexels rate limit (200 req/hr on free tier)
        await new Promise(r => setTimeout(r, 300));
      } catch (error) {
        console.error(`\n   ⚠️  Error fetching "${term}" page ${page}: ${error.message}`);
        break;
      }
    }
    console.log(""); // newline after each term
  }

  collected = collected.slice(0, 200);

  fs.writeFileSync("moments_seed.json", JSON.stringify(collected, null, 2));
  console.log(`\n✅  Saved ${collected.length} videos → moments_seed.json`);
  console.log("   Next step: node importMomentsSeed.js");
}

fetchVideos();
