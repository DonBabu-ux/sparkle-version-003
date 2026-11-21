'use strict';
require('dotenv').config({ path: './.env' });
const mysql = require('mysql2/promise');
const https = require('https');
const http = require('http');

async function main() {
  console.log('Connecting to MySQL database...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
  });

  console.log('Connected successfully to database:', process.env.DB_NAME);

  // 1. Find all tables and string/json columns in database
  const [columns] = await connection.query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = ? 
      AND DATA_TYPE IN ('varchar', 'text', 'mediumtext', 'longtext', 'json', 'char')
    ORDER BY TABLE_NAME, COLUMN_NAME
  `, [process.env.DB_NAME]);

  console.log(`Found ${columns.length} textual/JSON columns to scan across tables.`);

  // 2. Scan each column for 'cloudinary' or 'res.cloudinary.com'
  const tablesWithCloudinary = new Map();
  const allCloudinaryUrls = new Set();
  const urlOccurrences = new Map(); // url -> list of { table, column, id }

  for (const col of columns) {
    const table = col.TABLE_NAME;
    const column = col.COLUMN_NAME;

    try {
      const [rows] = await connection.query(`
        SELECT \`${column}\` as val FROM \`${table}\` 
        WHERE \`${column}\` LIKE '%cloudinary%'
      `);

      if (rows.length > 0) {
        if (!tablesWithCloudinary.has(table)) {
          tablesWithCloudinary.set(table, []);
        }
        tablesWithCloudinary.get(table).push({ column, count: rows.length });

        for (const row of rows) {
          const val = row.val;
          if (!val) continue;

          // Find all urls in value (could be single URL or JSON array)
          const urlMatches = String(val).match(/https?:\/\/[^\s"',;<>)]+cloudinary\.com[^\s"',;<>)]+/g);
          if (urlMatches) {
            for (const u of urlMatches) {
              const cleanUrl = u.trim();
              allCloudinaryUrls.add(cleanUrl);
              if (!urlOccurrences.has(cleanUrl)) {
                urlOccurrences.set(cleanUrl, []);
              }
              urlOccurrences.get(cleanUrl).push({ table, column });
            }
          }
        }
      }
    } catch (err) {
      // Ignore tables or columns that cannot be queried
    }
  }

  console.log('\n=== CLOUDINARY TABLE INVENTORY ===');
  let totalReferences = 0;
  for (const [table, cols] of tablesWithCloudinary.entries()) {
    console.log(`Table: ${table}`);
    for (const c of cols) {
      console.log(`  - Column \`${c.column}\`: ${c.count} row(s) containing Cloudinary`);
      totalReferences += c.count;
    }
  }

  console.log(`\nTotal tables containing Cloudinary references: ${tablesWithCloudinary.size}`);
  console.log(`Total database row references: ${totalReferences}`);
  console.log(`Total distinct Cloudinary URLs: ${allCloudinaryUrls.size}`);

  // 3. Classify distinct URLs by media type
  let imageCount = 0;
  let videoCount = 0;
  let audioCount = 0;
  let otherCount = 0;

  const imageExts = /\.(jpg|jpeg|png|webp|gif|svg|avif|heic)($|\?)/i;
  const videoExts = /\.(mp4|webm|mov|mkv|avi|m4v)($|\?)/i;
  const audioExts = /\.(mp3|wav|ogg|m4a|aac|opus)($|\?)/i;

  const urlList = Array.from(allCloudinaryUrls);

  for (const url of urlList) {
    if (url.includes('/video/upload/') || videoExts.test(url)) {
      videoCount++;
    } else if (audioExts.test(url) || url.includes('/raw/upload/') && url.includes('audio')) {
      audioCount++;
    } else if (url.includes('/image/upload/') || imageExts.test(url)) {
      imageCount++;
    } else {
      otherCount++;
    }
  }

  console.log('\n=== ASSET TYPE BREAKDOWN ===');
  console.log(`Images: ${imageCount}`);
  console.log(`Videos: ${videoCount}`);
  console.log(`Audio: ${audioCount}`);
  console.log(`Other/Unknown: ${otherCount}`);

  // 4. Check for duplicate references (same URL referenced multiple times)
  let duplicateRefCount = 0;
  for (const [url, refs] of urlOccurrences.entries()) {
    if (refs.length > 1) {
      duplicateRefCount++;
    }
  }
  console.log(`\nDistinct URLs referenced in multiple places: ${duplicateRefCount}`);

  // 5. Inspect media_registry table specifically
  try {
    const [regRows] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN secure_url LIKE '%cloudinary%' THEN 1 END) as cloudinary_count,
        COUNT(CASE WHEN lifecycle_state = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN lifecycle_state = 'deleted' THEN 1 END) as deleted_count,
        COALESCE(SUM(file_size_bytes), 0) as total_bytes
      FROM media_registry
    `);
    console.log('\n=== MEDIA_REGISTRY AUDIT ===');
    console.log('Total rows in media_registry:', regRows[0].total);
    console.log('Cloudinary rows:', regRows[0].cloudinary_count);
    console.log('Active assets:', regRows[0].active_count);
    console.log('Deleted assets:', regRows[0].deleted_count);
    console.log('Known size recorded (bytes):', regRows[0].total_bytes, `(${(regRows[0].total_bytes / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (err) {
    console.log('Note: media_registry table query:', err.message);
  }

  // 6. Test a sample of URLs for accessibility (HTTP status)
  console.log('\nTesting accessibility of a sample of Cloudinary URLs...');
  const sampleUrls = urlList.slice(0, 15);
  let accessibleCount = 0;
  let inaccessibleCount = 0;

  async function checkUrl(url) {
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    });
  }

  for (const u of sampleUrls) {
    const status = await checkUrl(u);
    if (status >= 200 && status < 400) {
      accessibleCount++;
    } else {
      inaccessibleCount++;
      console.log(`  - Inaccessible URL (${status}): ${u.slice(0, 80)}...`);
    }
  }
  console.log(`Sample test: ${sampleUrls.length} checked -> ${accessibleCount} accessible (HTTP 2xx/3xx), ${inaccessibleCount} inaccessible/expired`);

  await connection.end();
  console.log('\nAudit complete.');
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
