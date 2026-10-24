/**
 * READ-ONLY: verify the planned safe-rendition rewrites actually resolve.
 *   Cloudinary:  /video/upload/  ->  /video/upload/w_1080,c_limit,q_auto/
 *   Pexels:      uhd_2160_3840_30fps  ->  hd_1080_1920_30fps  (same id/fps)
 */
require('dotenv').config({ path: 'C:/Users/senior/Documents/sparkle-version-003-main/backend/.env' });
const pool = require('C:/Users/senior/Documents/sparkle-version-003-main/backend/config/database');

async function status(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
        const r = await fetch(url, { headers: { Range: 'bytes=0-32' }, signal: ctrl.signal, redirect: 'follow' });
        return r.status;
    } catch (e) { return e?.name === 'AbortError' ? 'timeout' : `err:${e?.cause?.code || e?.message}`; }
    finally { clearTimeout(t); }
}

async function run() {
    const [cloud] = await pool.query(
        `SELECT media_url FROM moments WHERE media_url LIKE '%res.cloudinary.com/drwldeniw/video/upload/%' LIMIT 3`
    );
    console.log('=== CLOUDINARY w_1080,c_limit,q_auto transform ===');
    for (const r of cloud) {
        const safe = r.media_url.replace(/\/video\/upload\/(v\d+)/, '/video/upload/w_1080,c_limit,q_auto/$1');
        console.log(` orig ${await status(r.media_url)}  safe ${await status(safe)}  ${safe.slice(0, 120)}`);
    }

    const [pex] = await pool.query(
        `SELECT media_url FROM moments WHERE media_url LIKE '%pexels.com%uhd_%' LIMIT 3`
    );
    console.log('=== PEKELS uhd -> hd_ swap (dimensions halved, fps kept) ===');
    for (const r of pex) {
        const swapped = r.media_url.replace(/-uhd_(\d+)_(\d+)_(\d+fps)\.mp4$/i, (_, w, h, fps) => {
            const hw = Math.round(parseInt(w, 10) / 2 / 2) * 2;
            const hh = Math.round(parseInt(h, 10) / 2 / 2) * 2;
            return `-hd_${hw}_${hh}_${fps}.mp4`;
        });
        console.log(` orig  ${await status(r.media_url)}  swap  ${await status(swapped)}`);
        console.log(`   ${r.media_url.slice(0, 110)}`);
        console.log(`   ${swapped.slice(0, 110)}`);
    }
    pool.end();
}
run().catch((e) => { console.error('failed:', e.message); pool.end(); });
