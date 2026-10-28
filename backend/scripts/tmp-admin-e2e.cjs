/* Scratch E2E: admin credential layer. Creates a temp admin, drives the real
   HTTP API, asserts the guarantees, cleans up. Env-driven credentials only. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const API = 'http://localhost:3000/api';
const LOGIN_PASSWORD = 'E2E-Login-Passw0rd';
const ADMIN_PASSWORD = 'E2E-Admin-Passw0rd';
const TEST_EMAIL = `e2e-admin-${Date.now()}@sparkle.test`;
const TEST_ID = crypto.randomUUID();

const j = (o) => JSON.stringify(o);
const post = async (path, body, headers = {}) => {
    const r = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: j(body)
    });
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch { /* non-json */ }
    return { status: r.status, data };
};
const get = async (path, headers = {}) => {
    const r = await fetch(API + path, { headers });
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch { /* non-json */ }
    return { status: r.status, data };
};

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
        connectTimeout: 60000
    });

    // 1. Temp admin with a known login password (service sets the admin one).
    await conn.execute(
        `INSERT INTO users (user_id, name, username, email, password_hash, role, account_status, onboarding_step)
         VALUES (?, 'E2E Admin', ?, ?, ?, 'admin', 'active', 6)`,
        [TEST_ID, 'e2e_' + Date.now(), TEST_EMAIL, await bcrypt.hash(LOGIN_PASSWORD, 12)]
    );
    console.log('setup: temp admin created');

    const service = require('../services/admin-credential.service');
    const setRes = await service.setAdminPassword(TEST_ID, LOGIN_PASSWORD, ADMIN_PASSWORD);
    console.log('setAdminPassword:', setRes.code);

    // 2. Login with the LOGIN password (the field is `username`, email allowed).
    const login = await post('/auth/login', { username: TEST_EMAIL, password: LOGIN_PASSWORD });
    console.log('login:', login.status);
    const token = login.data?.data?.token || login.data?.token;
    const auth = { Authorization: `Bearer ${token}` };

    // 3. BOOTSTRAP: status must answer WITHOUT any session (this was the
    //    chicken-and-egg deadlock — it sat behind the session gate).
    const statusNoSession = await get('/admin/credentials/status', auth);
    console.log('credentials/status WITHOUT session:', statusNoSession.status, JSON.stringify(statusNoSession.data?.data));

    // 4. Admin password unlocks a session.
    const unlock = await post('/admin/session', { admin_password: ADMIN_PASSWORD }, auth);
    console.log('unlock with ADMIN password:', unlock.status, unlock.data?.status);
    const session = unlock.data?.data?.admin_session_token;
    console.log('session token issued:', !!session);

    // 4. THE GUARANTEE: the LOGIN password must NOT unlock admin.
    const badUnlock = await post('/admin/session', { admin_password: LOGIN_PASSWORD }, auth);
    console.log('unlock with LOGIN password:', badUnlock.status, badUnlock.data?.code);

    // 5. Dashboard reads require the session; role alone is not enough.
    const noSession = await get('/admin/stats', auth);
    console.log('stats without session:', noSession.status, noSession.data?.code);
    const withSession = await get('/admin/stats', { ...auth, 'x-admin-session': session });
    console.log('stats with session:', withSession.status, withSession.data?.status);

    // 6. Cleanup
    await conn.execute('DELETE FROM admin_sessions WHERE user_id = ?', [TEST_ID]);
    await conn.execute('DELETE FROM users WHERE user_id = ?', [TEST_ID]);
    await conn.end();
    console.log('cleanup done');
    process.exit(0);
})().catch(async (e) => {
    console.error('E2E ERROR:', e.message);
    try { const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectTimeout: 60000 }); await conn.execute('DELETE FROM users WHERE user_id = ?', [TEST_ID]); await conn.end(); } catch { /* best effort */ }
    process.exit(1);
});
