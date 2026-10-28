'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// The admin credential service reads the pool lazily through pool.query, so a
// stub over the shared module gives real unit coverage without a database.
const pool = require('../backend/config/database');
const service = require('../backend/services/admin-credential.service');

const USER_PASSWORD = 'User-Login-Passw0rd';
const ADMIN_PASSWORD = 'Admin-Only-Passw0rd';
const NEW_ADMIN_PASSWORD = 'Admin-Only-Passw0rd-2';

function installUserStub(user) {
    const original = pool.query;
    pool.query = async (sql, params) => {
        if (sql.includes('admin_password_hash FROM users')) return [[user]];
        if (sql.includes('UPDATE users SET admin_password_hash')) {
            user.admin_password_hash = params[0];
            return [{ affectedRows: 1 }];
        }
        throw new Error(`Unexpected SQL in stub: ${sql}`);
    };
    return () => { pool.query = original; };
}

async function makeUser(role = 'admin') {
    return {
        user_id: 'u1',
        role,
        password_hash: await bcrypt.hash(USER_PASSWORD, 12),
        admin_password_hash: null
    };
}

test('admin password is stored as its own hash, distinct from the login password', async () => {
    const user = await makeUser();
    const restore = installUserStub(user);
    try {
        const res = await service.setAdminPassword('u1', USER_PASSWORD, ADMIN_PASSWORD);
        assert.equal(res.ok, true);
        assert.ok(user.admin_password_hash);
        assert.notEqual(user.admin_password_hash, user.password_hash);
        assert.ok(await bcrypt.compare(ADMIN_PASSWORD, user.admin_password_hash));
    } finally { restore(); }
});

test('GUARANTEE #1: the admin password can never equal the login password', async () => {
    const user = await makeUser();
    const restore = installUserStub(user);
    try {
        const res = await service.setAdminPassword('u1', USER_PASSWORD, USER_PASSWORD);
        assert.equal(res.ok, false);
        assert.equal(res.code, 'equals_login_password');
        assert.equal(user.admin_password_hash, null);
    } finally { restore(); }
});

test('GUARANTEE #2: the previous admin password cannot be reused', async () => {
    const user = await makeUser();
    user.admin_password_hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const restore = installUserStub(user);
    try {
        const res = await service.setAdminPassword('u1', USER_PASSWORD, ADMIN_PASSWORD);
        assert.equal(res.ok, false);
        assert.equal(res.code, 'equals_previous');

        const rotated = await service.setAdminPassword('u1', USER_PASSWORD, NEW_ADMIN_PASSWORD);
        assert.equal(rotated.ok, true);
        assert.ok(await bcrypt.compare(NEW_ADMIN_PASSWORD, user.admin_password_hash));
    } finally { restore(); }
});

test('GUARANTEE #3: verification only ever matches the admin password', async () => {
    const user = await makeUser();
    const restore = installUserStub(user);
    try {
        await service.setAdminPassword('u1', USER_PASSWORD, ADMIN_PASSWORD);
        assert.equal(await service.verifyAdminPassword('u1', ADMIN_PASSWORD), true);
        // the login password must NOT unlock the admin credential
        assert.equal(await service.verifyAdminPassword('u1', USER_PASSWORD), false);
        assert.equal(await service.verifyAdminPassword('u1', ''), false);
    } finally { restore(); }
});

test('GUARANTEE #4: fail-closed when no admin password is set', async () => {
    const user = await makeUser();
    const restore = installUserStub(user);
    try {
        assert.equal(await service.verifyAdminPassword('u1', ADMIN_PASSWORD), false);
        assert.equal(await service.verifyAdminPassword('u1', USER_PASSWORD), false);
        assert.equal(await service.hasAdminPassword('u1'), false);
    } finally { restore(); }
});

test('the caller must prove account ownership with the login password', async () => {
    const user = await makeUser();
    const restore = installUserStub(user);
    try {
        const res = await service.setAdminPassword('u1', 'wrong-password', ADMIN_PASSWORD);
        assert.equal(res.ok, false);
        assert.equal(res.code, 'current_password');
        assert.equal(user.admin_password_hash, null);
    } finally { restore(); }
});

test('non-admin roles cannot set an admin password', async () => {
    const user = await makeUser('user');
    const restore = installUserStub(user);
    try {
        const res = await service.setAdminPassword('u1', USER_PASSWORD, ADMIN_PASSWORD);
        assert.equal(res.ok, false);
        assert.equal(res.code, 'forbidden');
    } finally { restore(); }
});

test('admin password enforces a minimum length', async () => {
    const user = await makeUser();
    const restore = installUserStub(user);
    try {
        const res = await service.setAdminPassword('u1', USER_PASSWORD, 'short');
        assert.equal(res.ok, false);
        assert.equal(res.code, 'weak');
    } finally { restore(); }
});

test('step-up verification is wired to the admin credential, not password_hash', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'controllers', 'security.controller.js'), 'utf8');

    // admin_step_up branch must call the admin service and fail closed
    assert.ok(src.includes("tx.purpose === 'admin_step_up'"), 'admin step-up branch exists');
    assert.ok(src.includes("adminService.verifyAdminPassword(userId, code)"), 'admin step-up verifies against the admin credential');
    assert.ok(src.includes("'admin_password_not_set'"), 'step-up fails closed when no admin password is set');

    // the branch must sit BEFORE the generic password_hash check
    const adminIdx = src.indexOf("tx.purpose === 'admin_step_up'");
    const genericIdx = src.indexOf('SELECT password_hash FROM users WHERE user_id = ?');
    assert.ok(adminIdx < genericIdx, 'admin branch precedes the generic password check');
});

test('boot no longer auto-promotes the first user to admin', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'utils', 'database', 'init.js'), 'utf8');
    assert.ok(src.includes('ADMIN_EMAILS'), 'promotions are env-gated');
    assert.ok(!/UPDATE users SET role = "admin" WHERE user_id = \?[\s\S]{0,200}ORDER BY joined_at/.test(src), 'no first-user auto-promotion remains');
});

test('no committed credential in the reset script', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'reset_password.js'), 'utf8');
    // Guards against any hardcoded credential, without embedding one in this
    // repo: the source must read from the environment and contain no literal
    // password assignment at all.
    assert.ok(!/const\s+password\s*=\s*['"`]/.test(src), 'no hardcoded password literal');
    assert.ok(src.includes('RESET_USER_EMAIL') && src.includes('RESET_NEW_PASSWORD'), 'inputs are env-driven');
});
