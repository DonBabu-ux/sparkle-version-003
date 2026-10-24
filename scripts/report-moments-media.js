/**
 * READ-ONLY diagnostic: list every moment's media URL and probe it for
 * liveness, grouped by owner (seeded vs real users). Writes nothing.
 *
 * Usage:  node scripts/report-moments-media.js [limit]   (default limit: 300)
 */
require('dotenv').config({ path: 'backend/.env' });
require('dotenv').config();
const pool = require('../backend/config/database');

const API_BASE = (process.env.API_URL || 'https://sparkle-version-003-1-f4v3.onrender.com').replace(/\/+$/, '');
const LIMIT = parseInt(process.argv[2], 10) || 300;
const TIMEOUT_MS = 6000;

function resolveUrl(url) {
    if (!url) return null;
    const u = String(url).trim();
    if (!u) return null;
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return API_BASE + (u.startsWith('/') ? u : '/' + u);
}

async function probe(url) {
    const abs = resolveUrl(url);
    if (!abs) return { status: 'no-url', url: null };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(abs, { method: 'GET', signal: ctrl.signal, redirect: 'follow' });
        return { status: res.status, url: abs };
    } catch (err) {
        return { status: err?.name === 'AbortError' ? 'timeout' : `err:${err?.cause?.code || err?.code || err?.message}`, url: abs };
    } finally {
        clearTimeout(timer);
    }
}

async function run() {
    const [rows] = await pool.query(
        `SELECT m.moment_id, m.user_id, m.media_type, m.media_url, m.video_url, m.created_at,
                u.username, u.is_seed
           FROM moments m
           LEFT JOIN users u ON u.user_id = m.user_id
          ORDER BY m.created_at DESC
          LIMIT ?`,
        [LIMIT]
    );

    console.log(`\n=== MOMENTS MEDIA REPORT — ${rows.length} rows scanned (limit ${LIMIT}) ===`);

    const seen = new Map();
    const dead = [];
    const stats = { ok: 0, dead: 0, seedDead: 0, realDead: 0, seedTotal: 0, realTotal: 0 };

    for (const m of rows) {
        const isSeed = m.is_seed === 1 || m.is_seed === true;
        if (isSeed) stats.seedTotal++; else stats.realTotal++;
        const urls = [m.media_url, m.video_url].filter(Boolean).map(String);
        for (const u of urls) {
            if (seen.has(u)) {
                const prev = seen.get(u);
                if (prev.status !== 200 && prev.status !== 'ok') dead.push({ ...m, url: u, status: prev.status });
                continue;
            }
            const p = await probe(u);
            seen.set(u, p);
            if (p.status === 200) { stats.ok++; continue; }
            dead.push({ ...m, url: u, status: p.status });
            stats.dead++;
            if (isSeed) stats.seedDead++; else stats.realDead++;
        }
    }

    const byHost = {};
    for (const d of dead) {
        let host = '(no-url)';
        try { host = new URL(d.url).hostname; } catch { host = new URL(resolveUrl(d.url) || 'http://x').hostname; }
        byHost[host] = (byHost[host] || 0) + 1;
    }

    console.log('\nSUMMARY');
    console.log(JSON.stringify(stats, null, 2));
    console.log('\nDEAD URLS BY HOST');
    console.log(JSON.stringify(byHost, null, 2));
    console.log(`\nSAMPLE DEAD (up to 30):`);
    for (const d of dead.slice(0, 30)) {
        console.log(` [${d.is_seed ? 'SEED' : 'user'}] @${d.username || d.user_id}  ${d.status}  ${d.url}`);
        console.log(`        moment ${d.moment_id} (${d.media_type})`);
    }
    if (dead.length > 30) console.log(` ...and ${dead.length - 30} more`);
    console.log('\n(no writes performed)\n');
}

run()
    .then(() => pool.end())
    .catch((err) => { console.error('report failed:', err.message); pool.end(); });
