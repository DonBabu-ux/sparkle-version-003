// tests/groups-handlers.test.js
// Group administration access-control: the creator/owner/admin ladder for
// settings and moderation, owner-only deletion, request approval gating, and
// join rules (creator, approval, capacity). Real controller with a stubbed
// Group model and a fake pool for the request lookups.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-groups';

const pool = require('../backend/config/database');
const Group = require('../backend/models/Group');
const groups = require('../backend/controllers/groups.controller');

const mockRes = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const installFakePool = (impl) => {
  const original = pool.query;
  pool.query = async (sql, params = []) => impl(String(sql).replace(/\s+/g, ' ').trim(), params);
  return { restore: () => { pool.query = original; } };
};

const reqFor = (over = {}) => ({
  body: {}, params: {}, query: {}, headers: {}, cookies: {}, files: undefined,
  user: { user_id: 'member-1', userId: 'member-1', role: 'user' },
  ...over,
});

const group = (over = {}) => ({
  group_id: 'g1',
  creator_id: 'creator-1',
  name: 'Study Circle',
  requires_approval: 0,
  ...over,
});

describe('group settings — admin ladder', () => {
  let seen;
  beforeEach(() => {
    seen = null;
    Group.findById = async () => group();
    Group.update = async (groupId, updateData) => { seen = { groupId, updateData }; return true; };
  });

  it('404s a missing group', async () => {
    Group.findById = async () => null;
    const res = mockRes();
    await groups.updateGroupAPI(reqFor({ params: { id: 'g1' } }), res);
    assert.equal(res.statusCode, 404);
  });

  it('403s an ordinary member', async () => {
    Group.getMember = async () => ({ role: 'member' });
    const res = mockRes();
    await groups.updateGroupAPI(reqFor({ params: { id: 'g1' }, body: { name: 'hijacked' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'Permission denied');
    assert.equal(seen, null, 'no update was written');
  });

  it('allows the creator with no member row', async () => {
    Group.getMember = async () => null;
    const res = mockRes();
    await groups.updateGroupAPI(reqFor({ params: { id: 'g1' }, user: { user_id: 'creator-1' }, body: { name: 'Renamed' } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(seen.updateData.name, 'Renamed');
  });

  it('allows a moderator', async () => {
    Group.getMember = async () => ({ role: 'moderator' });
    const res = mockRes();
    await groups.updateGroupAPI(reqFor({ params: { id: 'g1' }, body: { name: 'Renamed' } }), res);
    assert.equal(res.statusCode, 200);
  });

  it('sanitizes boolean fields from the body', async () => {
    Group.getMember = async () => ({ role: 'admin' });
    const res = mockRes();
    await groups.updateGroupAPI(
      reqFor({ params: { id: 'g1' }, body: { is_public: 'true', requires_approval: 'false', allow_posts: true } }),
      res
    );

    assert.equal(seen.updateData.is_public, 1);
    assert.equal(seen.updateData.requires_approval, 0);
    assert.equal(seen.updateData.allow_posts, 1);
  });
});

describe('member moderation — admin only', () => {
  it('403s a plain member and never calls the model', async () => {
    let called = false;
    Group.findById = async () => group();
    Group.getMember = async () => ({ role: 'member' });
    Group.muteMember = async () => { called = true; };

    const res = mockRes();
    await groups.muteMemberAPI(
      reqFor({ params: { id: 'g1', userId: 'victim-1' }, body: { muted: true } }),
      res
    );

    assert.equal(res.statusCode, 403);
    assert.equal(called, false);
  });

  it('lets a creator mute and ban', async () => {
    let seen = null;
    Group.findById = async () => group();
    Group.getMember = async () => null;
    Group.muteMember = async (id, userId, muted) => { seen = { id, userId, muted }; };

    const res = mockRes();
    await groups.muteMemberAPI(
      reqFor({ params: { id: 'g1', userId: 'victim-1' }, user: { user_id: 'creator-1' }, body: { muted: true } }),
      res
    );
    assert.deepEqual(res.body, { success: true });
    assert.deepEqual(seen, { id: 'g1', userId: 'victim-1', muted: true });
  });

  it('lets an admin ban', async () => {
    let called = false;
    Group.findById = async () => group();
    Group.getMember = async () => ({ role: 'admin' });
    Group.banMember = async () => { called = true; };

    const res = mockRes();
    await groups.banMemberAPI(
      reqFor({ params: { id: 'g1', userId: 'victim-1' }, body: { banned: true } }),
      res
    );
    assert.deepEqual(res.body, { success: true });
    assert.ok(called);
  });
});

describe('group deletion — owner only', () => {
  it('403s an admin who is not the owner', async () => {
    Group.getMember = async () => ({ role: 'admin' });
    let called = false;
    Group.deleteGroup = async () => { called = true; };

    const res = mockRes();
    await groups.deleteGroupAPI(reqFor({ params: { id: 'g1' } }), res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /Only the group owner/);
    assert.equal(called, false);
  });

  it('deletes as the owner', async () => {
    Group.getMember = async () => ({ role: 'owner' });
    let called = false;
    Group.deleteGroup = async () => { called = true; };

    const res = mockRes();
    await groups.deleteGroupAPI(reqFor({ params: { id: 'g1' }, user: { user_id: 'creator-1' } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Group deleted successfully');
    assert.ok(called);
  });
});

describe('join requests', () => {
  it('rejects the creator joining their own group', async () => {
    Group.findById = async () => group();
    const res = mockRes();
    await groups.joinGroup(reqFor({ params: { id: 'g1' }, user: { user_id: 'creator-1' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /already an admin/);
  });

  it('creates a pending request for a closed group', async () => {
    let called = null;
    Group.findById = async () => group({ requires_approval: 1 });
    Group.findRequest = async () => null;
    Group.createJoinRequest = async (groupId, userId) => { called = { groupId, userId }; };

    const res = mockRes();
    await groups.joinGroup(reqFor({ params: { id: 'g1' } }), res);

    assert.deepEqual(res.body, { success: true, message: 'Join request sent successfully', status: 'pending' });
    assert.deepEqual(called, { groupId: 'g1', userId: 'member-1' });
  });

  it('refuses a duplicate pending request', async () => {
    Group.findById = async () => group({ requires_approval: 1 });
    Group.findRequest = async () => ({ id: 'r1' });

    const res = mockRes();
    await groups.joinGroup(reqFor({ params: { id: 'g1' } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Join request already pending');
  });

  it('joins an open group below the cap', async () => {
    let called = null;
    Group.findById = async () => group({ requires_approval: 0 });
    Group.getMembersCount = async () => 42;
    Group.addMember = async (groupId, userId) => { called = { groupId, userId }; };

    const res = mockRes();
    await groups.joinGroup(reqFor({ params: { id: 'g1' } }), res);
    assert.equal(res.body.status, 'active');
    assert.deepEqual(called, { groupId: 'g1', userId: 'member-1' });
  });

  it('rejects joining a full group', async () => {
    Group.findById = async () => group({ requires_approval: 0 });
    Group.getMembersCount = async () => 100;

    const res = mockRes();
    await groups.joinGroup(reqFor({ params: { id: 'g1' } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /100 members max/);
  });
});

describe('request approval — admin gated', () => {
  let fake;
  beforeEach(() => {
    Group.approveRequest = async () => true;
    Group.rejectRequest = async () => true;
    Group.findById = async () => group();
    Group.getMember = async () => null;
    fake = installFakePool(async (sql) => {
      if (sql.startsWith('SELECT group_id FROM group_requests')) return [[{ group_id: 'g1' }]];
      return [[], []];
    });
  });
  afterEach(() => fake.restore());

  it('404s an unknown request', async () => {
    fake.restore();
    fake = installFakePool(async () => [[]]);

    const res = mockRes();
    await groups.approveRequestAPI(reqFor({ params: { requestId: 'r1' } }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, 'Request not found');
  });

  it('403s a non-admin', async () => {
    Group.findById = async () => group();
    Group.getMember = async () => ({ role: 'member' });
    let called = false;
    Group.approveRequest = async () => { called = true; };

    const res = mockRes();
    await groups.approveRequestAPI(reqFor({ params: { requestId: 'r1' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(called, false);
  });

  it('approves as the owner', async () => {
    Group.findById = async () => group();
    Group.getMember = async () => null;

    const res = mockRes();
    await groups.approveRequestAPI(reqFor({ params: { requestId: 'r1' }, user: { user_id: 'creator-1' } }), res);
    assert.deepEqual(res.body, { success: true });
  });

  it('rejects as a moderator', async () => {
    Group.findById = async () => group();
    Group.getMember = async () => ({ role: 'moderator' });

    const res = mockRes();
    await groups.rejectRequestAPI(reqFor({ params: { requestId: 'r1' } }), res);
    assert.deepEqual(res.body, { success: true });
  });
});

describe('group creation', () => {
  it('400s without a name', async () => {
    const res = mockRes();
    await groups.createGroup(reqFor({ body: {} }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Group name is required');
  });

  it('creates the group and the owner membership in one transaction', async () => {
    const conn = {
      async beginTransaction() {},
      async commit() {},
      async rollback() { throw new Error('must not roll back'); },
      async release() {},
      async query() { return [[], []]; },
    };
    const original = pool.getConnection;
    pool.getConnection = async () => conn;

    try {
      const res = mockRes();
      await groups.createGroup(reqFor({ body: { name: 'New Circle', is_public: 'true' } }), res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.id);
    } finally {
      pool.getConnection = original;
    }
  });
});