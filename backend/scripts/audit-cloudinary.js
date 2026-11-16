/**
 * scripts/audit-cloudinary.js
 *
 * Full inventory of the Cloudinary account, cross-referenced against the
 * database: which stored media exists, how it is organized (folder), and which
 * resources are ORPHANS (present in Cloudinary but referenced by no DB row).
 *
 * Feeds the re-seed work: the orphan list is the delete candidate set, the
 * referenced set is what must be preserved.
 *
 * Usage:  node scripts/audit-cloudinary.js            (summary)
 *          node scripts/audit-cloudinary.js --json    (full report to stdout)
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD || !KEY || !SECRET) {
    console.error('Missing CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in backend/.env');
    process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Page through every resource of a type (image|video|raw). */
async function fetchResources(type) {
    const out = [];
    let cursor = null;
    for (let page = 0; page < 100; page++) {
        const url = new URL(`https://api.cloudinary.com/v1_1/${CLOUD}/resources/${type}`);
        url.searchParams.set('max_results', '500');
        if (cursor) url.searchParams.set('next_cursor', cursor);
        let res;
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                res = await fetch(url, { headers: { Authorization: AUTH }, signal: AbortSignal.timeout(30000) });
                if (res.status === 429 || res.status >= 500) throw new Error('retryable ' + res.status);
                break;
            } catch (e) {
                if (attempt === 3) throw new Error(`${type} page ${page} failed: ${e.message}`);
                await sleep(1500 * (attempt + 1));
            }
        }
        if (!res.ok) throw new Error(`${type} page ${page}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
        const body = await res.json();
        out.push(...(body.resources || []));
        cursor = body.next_cursor;
        if (!cursor) break;
    }
    return out;
}

/** public_id from any res.cloudinary.com URL (version + extension stripped). */
function publicIdFromUrl(url) {
    if (!url) return null;
    const m = String(url).match(/res\.cloudinary\.com\/[^/]+\/[^/]+\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i);
    return m ? m[1] : null;
}

/** Folder = first path segment of the public_id. */
const folderOf = (id) => (id && id.includes('/') ? id.split('/')[0] : '(root)');

(async () => {
    const asJson = process.argv.includes('--json');

    // 1. Cloudinary inventory
    const [images, videos, raws] = await Promise.all([fetchResources('image'), fetchResources('video'), fetchResources('raw')]);
    const all = [...images, ...videos, ...raws];
    const byId = new Map(all.map(r => [r.public_id, r]));

    // 2. Every media URL referenced anywhere in the DB
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: 3306, user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectTimeout: 20000,
    });
    const refTables = [
        ['posts', 'media_url'],
        ['post_media', 'media_url'],
        ['media_registry', 'secure_url'],
        ['listing_media', 'media_url'],
        ['lost_found_media', 'media_url'],
        ['users', 'avatar_url'],
        ['moments', 'media_url'],
        ['groups', 'avatar_url'],
    ];
    const referenced = new Set();
    for (const [table, col] of refTables) {
        try {
            const [rows] = await conn.query(`SELECT \`${col}\` AS u FROM \`${table}\` WHERE \`${col}\` IS NOT NULL AND \`${col}\`<>''`);
            for (const r of rows) { const id = publicIdFromUrl(r.u); if (id) referenced.add(id); }
        } catch (e) { /* table may not exist in this schema state */ }
    }
    await conn.end();

    // 3. Classify
    const orphans = all.filter(r => !referenced.has(r.public_id));
    const referencedInCloud = all.filter(r => referenced.has(r.public_id));
    const referencedMissing = [...referenced].filter(id => !byId.has(id));

    const folders = {};
    for (const r of all) { const f = folderOf(r.public_id); folders[f] = folders[f] || { total: 0, orphan: 0, bytes: 0 }; folders[f].total++; folders[f].bytes += r.bytes || 0; }
    for (const r of orphans) { const f = folderOf(r.public_id); folders[f].orphan++; }

    const summary = {
        cloudinary: {
            images: images.length, videos: videos.length, raw: raws.length, total: all.length,
            bytes: all.reduce((s, r) => s + (r.bytes || 0), 0),
        },
        db: { referencedPublicIds: referenced.size, matchedInCloud: referencedInCloud.length, referencedButMissingInCloud: referencedMissing.length },
        orphans: { count: orphans.length, bytes: orphans.reduce((s, r) => s + (r.bytes || 0), 0) },
        folders,
    };

    if (asJson) {
        console.log(JSON.stringify({ summary, orphanSample: orphans.slice(0, 50).map(r => r.public_id), referencedMissingSample: referencedMissing.slice(0, 50) }, null, 2));
    } else {
        console.log('=== CLOUDINARY AUDIT ===');
        console.log(`account: ${CLOUD}`);
        console.log(`resources: ${all.length} (${images.length} images, ${videos.length} videos, ${raws.length} raw) = ${(summary.cloudinary.bytes / 1048576).toFixed(1)} MB`);
        console.log(`DB references: ${referenced.size} public_ids | matched in Cloudinary: ${referencedInCloud.length} | referenced but MISSING: ${referencedMissing.length}`);
        console.log(`ORPHANS (in Cloudinary, referenced nowhere): ${orphans.length} = ${(summary.orphans.bytes / 1048576).toFixed(1)} MB`);
        console.log('\nby folder (total / orphans / MB):');
        Object.entries(folders).sort((a, b) => b[1].total - a[1].total).forEach(([f, v]) => {
            console.log(`  ${f.padEnd(28)} ${String(v.total).padStart(5)} total ${String(v.orphan).padStart(5)} orphan ${(v.bytes / 1048576).toFixed(1).padStart(8)} MB`);
        });
        if (referencedMissing.length) console.log('\nreferenced-but-missing sample:', referencedMissing.slice(0, 8));
    }
})().catch(e => { console.error('AUDIT ERROR:', e.message); process.exit(1); });