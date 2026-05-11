/**
 * fix-moments-seed.js
 * 
 * Fixes two issues with the seeded moments data:
 * 1. Normalizes category values to Title Case so the ranking service can
 *    match them against its category pool queries.
 * 2. Creates the user_signals_bridge table needed by the SIV engine.
 *
 * Usage: node fix-moments-seed.js
 */
require("dotenv").config();
const pool = require("./config/database");

// Map seed categories → ranking-service Title Case
const CATEGORY_MAP = {
  people:     "Social",
  nature:     "Nature",
  city:       "Lifestyle",
  campus:     "Academic",
  music:      "Music",
  cars:       "Lifestyle",
  football:   "Sports",
  fashion:    "Fashion",
  travel:     "Travel",
  technology: "Technology",
};

async function run() {
  console.log("🔧  Starting moments seed fix...\n");

  // ── 1. Create user_signals_bridge (SIV engine dependency) ───────────────
  console.log("1️⃣   Creating user_signals_bridge table...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_signals_bridge (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     CHAR(36)     NOT NULL,
      category    VARCHAR(50)  NOT NULL,
      signal_strength FLOAT    DEFAULT 0,
      updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_category (user_id, category),
      INDEX idx_usb_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("   ✅  user_signals_bridge ready\n");

  // ── 2. Normalize category casing in moments table ────────────────────────
  console.log("2️⃣   Fixing moment categories (lowercase → Title Case)...");
  let totalUpdated = 0;

  for (const [from, to] of Object.entries(CATEGORY_MAP)) {
    const [result] = await pool.query(
      "UPDATE moments SET category = ? WHERE category = ?",
      [to, from]
    );
    if (result.affectedRows > 0) {
      console.log(`   ✅  "${from}" → "${to}"  (${result.affectedRows} rows)`);
      totalUpdated += result.affectedRows;
    }
  }
  console.log(`\n   Total updated: ${totalUpdated} moments\n`);

  // ── 3. Verify distribution ───────────────────────────────────────────────
  console.log("3️⃣   Current category distribution:");
  const [cats] = await pool.query(`
    SELECT category, COUNT(*) as count
    FROM moments
    GROUP BY category
    ORDER BY count DESC
  `);
  cats.forEach(r => console.log(`   ${(r.category || "NULL").padEnd(16)} ${r.count}`));

  // ── 4. Sanity check trending pool eligibility ────────────────────────────
  console.log("\n4️⃣   Trending pool eligibility (last 48h, any likes):");
  const [[{ trending }]] = await pool.query(`
    SELECT COUNT(*) as trending
    FROM moments
    WHERE created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)
  `);
  const [[{ strangers }]] = await pool.query(`
    SELECT COUNT(*) as strangers
    FROM moments
    WHERE like_count > 10
  `);
  console.log(`   Trending pool candidates  : ${trending}`);
  console.log(`   Strangers pool candidates : ${strangers}`);

  if (trending < 20) {
    console.log("\n⚠️   Trending pool is thin (<20). Refreshing created_at timestamps...");
    // Push all moments into last 24h so the trending pool fills
    await pool.query(`
      UPDATE moments
      SET created_at = DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 1440) MINUTE)
      WHERE created_at <= DATE_SUB(NOW(), INTERVAL 48 HOUR)
    `);
    const [[{ fixed }]] = await pool.query(
      "SELECT COUNT(*) as fixed FROM moments WHERE created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)"
    );
    console.log(`   ✅  ${fixed} moments now in trending window`);
  }

  console.log("\n✅  Fix complete! The ranking service will now populate category pools correctly.");
  process.exit(0);
}

run().catch(err => {
  console.error("❌  Fatal:", err.message);
  process.exit(1);
});
