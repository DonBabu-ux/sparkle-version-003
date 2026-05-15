const axios = require("axios");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

// Pexels API Key
const API_KEY = process.env.PEXELS_API_KEY;

if (!API_KEY) {
  console.error("❌  Error: PEXELS_API_KEY is missing in .env file.");
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'drwldeniw',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const searchTerms = [
  "fashion", "travel", "technology", "nature", "city", 
  "nightlife", "dance", "fitness", "cooking", "automotive"
];

async function fetchVideos() {
  console.log("🎬  Starting High-Fidelity HD Moment Fetch (Signed Fetch Logic)...\n");
  let collected = [];

  for (const term of searchTerms) {
    console.log(`   → Fetching HD: "${term}"`);
    for (let page = 1; page <= 5; page++) {
      try {
        const res = await axios.get(
          `https://api.pexels.com/videos/search?query=${term}&per_page=40&page=${page}`,
          { headers: { Authorization: API_KEY } }
        );

        const videos = res.data.videos
          .filter(v => v.height > v.width) // STRICT VERTICAL ONLY
          .map(v => {
            const hdFile = v.video_files.find(f => f.quality === "hd" || f.quality === "uhd") || v.video_files[0];
            const rawUrl = hdFile.link;
            
            // Generate Signed Cloudinary Fetch URLs
            const streamingUrl = cloudinary.url(rawUrl, {
              type: 'fetch',
              resource_type: 'video',
              format: 'm3u8',
              streaming_profile: 'full_hd',
              sign_url: true
            });

            const thumbnailUrl = cloudinary.url(rawUrl, {
              type: 'fetch',
              resource_type: 'video',
              format: 'jpg',
              width: 1080,
              height: 1920,
              crop: 'fill',
              start_offset: 0,
              sign_url: true
            });
            
            return {
              caption: `${term.charAt(0).toUpperCase() + term.slice(1)} vibe in the village ✨ #sparkle #${term} #hd`,
              mediaUrl: rawUrl,
              streamingUrl,
              thumbnailUrl,
              mediaType: "video",
              category: term,
              duration: v.duration,
              resolution: `${v.width}x${v.height}`,
              bitrate: '6000k',
              viewCount: Math.floor(Math.random() * 80000) + 5000,
              likeCount: Math.floor(Math.random() * 8000) + 500,
              commentCount: Math.floor(Math.random() * 1000) + 100,
              createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString() 
            };
          });

        collected.push(...videos);
        process.stdout.write(`     page ${page}/5 — total vertical so far: ${collected.length}\r`);

        await new Promise(r => setTimeout(r, 400));
      } catch (error) {
        console.error(`\n   ⚠️  Error fetching "${term}": ${error.message}`);
        break;
      }
    }
    console.log(""); 
  }

  const seen = new Set();
  const unique = collected.filter(v => {
    if (seen.has(v.mediaUrl)) return false;
    seen.add(v.mediaUrl);
    return true;
  });

  console.log(`\n✨  Processing complete. Total unique vertical HD videos: ${unique.length}`);
  
  const finalSet = unique.slice(0, 250); 
  fs.writeFileSync("moments_seed.json", JSON.stringify(finalSet, null, 2));
  console.log(`✅  Saved ${finalSet.length} records → moments_seed.json`);
  console.log("👉  Next step: node importMomentsSeed.js");
}

fetchVideos();
