/* scratch E2E: new admin surfaces — analytics, verifications, log export, appeals */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const API = 'http://localhost:3000/api';
const LOGIN_PASSWORD = 'E2E-Login-Passw0rd';
const ADMIN_PASSWORD = 'E2E-Admin-Passw0rd';
const TEST_ID = crypto.randomUUID();
const TEST_EMAIL = `e2e2-admin-${Date.now()}@sparkle.test`;

const post = async (path, body, headers = {}) => {
    const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    let data = null; try { data = await r.json(); } catch { /* non-json */ }
    return { status: r.status, data };
};
const get = async (path, headers = {}) => {
    const r = await fetch(API + path, { headers });
    const ct = r.headers.get('content-type') || '';
    const body = ct.includes('json') ? await r.json() : await r.text();
    return { status: r.status, body };
};

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
        connectTimeout: 60000
    });
    await conn.execute(
        `INSERT INTO users (user_id, name, username, email, password_hash, role, account_status, onboarding_step)
         VALUES (?, 'E2E2 Admin', ?, ?, ?, 'admin', 'active', 6)`,
        [TEST_ID, 'e2e2_' + Date.now(), TEST_EMAIL, await bcrypt.hash(LOGIN_PASSWORD, 12)]
    );
    const service = require('../services/admin-credential.service');
    await service.setAdminPassword(TEST_ID, LOGIN_PASSWORD, ADMIN_PASSWORD);

    const login = await post('/auth/login', { username: TEST_EMAIL, password: LOGIN_PASSWORD });
    const token = login.data?.data?.token || login.data?.token;
    console.log('token extracted:', !!token);
    const auth = { Authorization: `Bearer ${token}` };
    console.log('login:', login.status);

    const unlock = await post('/admin/session', { admin_password: ADMIN_PASSWORD }, auth);
    const session = unlock.data?.data?.admin_session_token;
    console.log('unlock:', unlock.status);

    const admin = { ...auth, 'x-admin-session': session };

    const analytics = await get('/admin/analytics', admin);
    const d = analytics.body?.data || {};
    console.log('analytics:', analytics.status,
        '| series keys:', Object.keys(d.series || {}).length,
        '| signups pts:', (d.series?.signups || []).length,
        '| kpis:', JSON.stringify(d.kpis || {}));

    const verifs = await get('/admin/verifications', admin);
    console.log('verifications:', verifs.status, '| keys:', Object.keys(verifs.body || {}).join(','));

    const exportLogs = await get('/admin/logs/export', admin);
    console.log('logs/export:', exportLogs.status, '| type:', typeof exportLogs.body, '| bytes:', String(exportLogs.body).length);

    const appeals = await get('/moderation/appeals/pending', auth);
    console.log('appeals/pending:', appeals.status, '| appeals:', (appeals.body?.appeals || []).length);

    await conn.execute('DELETE FROM admin_sessions WHERE user_id = ?', [TEST_ID]);
    await conn.execute('DELETE FROM users WHERE user_id = ?', [TEST_ID]);
    await conn.end();
    console.log('cleanup done');
    process.exit(0);
})().catch(async (e) => {
    console.error('E2E ERROR:', e.message);
    try {
        const c = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectTimeout: 60000 });
        await c.execute('DELETE FROM users WHERE user_id = ?', [TEST_ID]);
        await c.end();
    } catch { /* best effort */ }
    process.exit(1);
});
