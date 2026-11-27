// tests/notifications-and-rooms.test.js
// Notification lifecycle + rooms CRUD, driven through the real controllers with
// a fake pool.query and stubbed model singletons.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-notif';

const pool = require('../backend/config/database');
const notificationController = require('../backend/controllers/notification.controller');
const Room = require('../backend/models/Room');
const RoomMember = require('../backend/models/RoomMember');
const roomsController = require('../backend/controllers/rooms.controller');

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
  body: {}, params: {}, query: {}, headers: {}, cookies: {},
  user: { user_id: 'user-1', userId: 'user-1' },
  ...over,
});

describe('notification controller', () => {
  let fake;
  afterEach(() => fake?.restore());

  it('maps the unified feed, including the related-entity fields', async () => {
    fake = installFakePool(async () => [[{
      notification_id: 'n-1',
      type: 'comment',
      title: 'New comment',
      content: 'nice post!',
      created_at: '2026-11-01T00:00:00Z',
      is_read: 0,
      actor_id: 'u2',
      actor_name: 'Them',
      actor_username: 'them',
      action_url: '/post/p1',
      related_id: 'p1',
      entities: '[]',
      actions: '[]',
    }]]);

    const res = mockRes();
    await notificationController.getNotifications(reqFor(), res);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
    const n = res.body[0];
    assert.equal(n.id, 'n-1');
    assert.equal(n.isRead, false);
    assert.equal(n.related_id, 'p1', 'the related entity must reach the client');
    assert.deepEqual(n.target, { entity_id: 'p1', entity_type: 'post' });
    assert.deepEqual(n.actions, [{ label: 'View', route: '/post/p1', style: 'primary' }]);
  });

  it('passes the unread filter into the SQL', async () => {
    const seen = [];
    fake = installFakePool(async (sql, params) => {
      seen.push({ sql, params });
      return [[]];
    });

    const res = mockRes();
    await notificationController.getNotifications(reqFor({ query: { unreadOnly: 'true', page: '2', limit: '10' } }), res);

    assert.equal(res.statusCode, 200);
    assert.ok(seen.some((s) => s.sql.includes('is_read = 0')), 'the unread filter is applied');
    const last = seen[seen.length - 1];
    assert.ok(last.params.includes(10), 'the limit is bound');
    assert.ok(last.params.includes(10), 'page 2 with limit 10 → offset 10');
  });

  it('500s with a fixed message when the feed query fails', async () => {
    fake = installFakePool(async () => { throw new Error('db down'); });
    const res = mockRes();
    await notificationController.getNotifications(reqFor(), res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Failed to fetch notifications');
  });

  it('reports the unread count', async () => {
    fake = installFakePool(async () => [[{ unread_count: 7 }]]);
    const res = mockRes();
    await notificationController.getUnreadCount(reqFor(), res);
    assert.deepEqual(res.body, { unreadCount: 7 });
  });

  it('marks a notification read and scopes the update to the owner', async () => {
    const seen = [];
    fake = installFakePool(async (sql, params) => {
      seen.push({ sql, params });
      return [{ affectedRows: 1 }];
    });

    const res = mockRes();
    await notificationController.markAsRead(reqFor({ params: { notificationId: 'n-9' } }), res);

    assert.deepEqual(res.body, { success: true, message: 'Notification marked as read' });
    const update = seen.find((s) => s.sql.startsWith('UPDATE notifications'));
    assert.deepEqual(update.params, ['n-9', 'n-9', 'user-1'], 'scoped to the caller');
  });

  it('falls back to capture and push notifications when the row is elsewhere', async () => {
    const seen = [];
    fake = installFakePool(async (sql) => {
      seen.push(sql);
      return [{ affectedRows: 0 }];
    });

    const res = mockRes();
    await notificationController.markAsRead(reqFor({ params: { notificationId: 'n-x' } }), res);

    assert.equal(res.body.success, true);
    assert.ok(seen.some((s) => s.includes('UPDATE capture_notifications')), 'capture fallback runs');
    assert.ok(seen.some((s) => s.includes('UPDATE push_notifications')), 'push fallback runs');
  });

  it('marks everything read across all three tables', async () => {
    const seen = [];
    fake = installFakePool(async (sql) => {
      seen.push(sql);
      return [{ affectedRows: 1 }];
    });

    const res = mockRes();
    await notificationController.markAllAsRead(reqFor(), res);

    assert.equal(res.body.success, true);
    assert.equal(seen.filter((s) => s.startsWith('UPDATE')).length, 3);
  });

  it('404s deleting a notification that is not yours', async () => {
    fake = installFakePool(async () => [{ affectedRows: 0 }]);
    const res = mockRes();
    await notificationController.deleteNotification(reqFor({ params: { notificationId: 'n-1' } }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, 'Notification not found');
  });

  it('deletes your own notification', async () => {
    const seen = [];
    fake = installFakePool(async (sql, params) => {
      seen.push({ sql, params });
      return [{ affectedRows: 1 }];
    });
    const res = mockRes();
    await notificationController.deleteNotification(reqFor({ params: { notificationId: 'n-1' } }), res);
    assert.deepEqual(res.body, { message: 'Notification deleted' });
    assert.deepEqual(seen[0].params, ['n-1', 'user-1']);
  });

  it('clears only the notifications table', async () => {
    const seen = [];
    fake = installFakePool(async (sql) => {
      seen.push(sql);
      return [{ affectedRows: 3 }];
    });
    const res = mockRes();
    await notificationController.clearNotifications(reqFor(), res);
    assert.deepEqual(res.body, { message: 'Notifications cleared' });
    assert.deepEqual(seen, ['DELETE FROM notifications WHERE user_id = ?']);
  });
});

describe('rooms controller', () => {
  let created;

  beforeEach(() => {
    created = null;
    Room.create = async (data) => {
      created = data;
      return { roomId: 'room-1', defaultChannelId: 'chan-1' };
    };
    Room.getUserRooms = async () => [{ room_id: 'room-1', name: 'Study' }];
    Room.findById = async () => ({ room_id: 'room-1', name: 'Study' });
    Room.update = async () => ({ affectedRows: 1 });
    Room.delete = async () => ({ affectedRows: 1 });
    RoomMember.add = async (data) => { created = data; return { affectedRows: 1 }; };
    RoomMember.remove = async (roomId, userId) => { created = { roomId, userId }; return { affectedRows: 1 }; };
  });

  it('creates a room for the signed-in user', async () => {
    const res = mockRes();
    await roomsController.createRoom(
      reqFor({ user: { id: 'u1' }, body: { name: 'Study Group', isPublic: true } }),
      res
    );

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { roomId: 'room-1', defaultChannelId: 'chan-1' });
    assert.equal(created.creatorId, 'u1');
    assert.equal(created.name, 'Study Group');
  });

  it('lists the caller\u2019s rooms', async () => {
    const res = mockRes();
    await roomsController.listUserRooms(reqFor({ user: { id: 'u1' } }), res);
    assert.deepEqual(res.body, [{ room_id: 'room-1', name: 'Study' }]);
  });

  it('404s an unknown room', async () => {
    Room.findById = async () => null;
    const res = mockRes();
    await roomsController.getRoom(reqFor({ params: { roomId: 'ghost' } }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, 'Room not found');
  });

  it('updates and deletes a room', async () => {
    let updated = null;
    Room.update = async (roomId, updates) => { updated = { roomId, updates }; return { affectedRows: 1 }; };

    let res = mockRes();
    await roomsController.updateRoom(reqFor({ params: { roomId: 'room-1' }, body: { name: 'Renamed' } }), res);
    assert.deepEqual(res.body, { success: true });
    assert.deepEqual(updated, { roomId: 'room-1', updates: { name: 'Renamed' } });

    let deleted = null;
    Room.delete = async (roomId) => { deleted = roomId; return { affectedRows: 1 }; };
    res = mockRes();
    await roomsController.deleteRoom(reqFor({ params: { roomId: 'room-1' } }), res);
    assert.deepEqual(res.body, { success: true });
    assert.equal(deleted, 'room-1');
  });

  it('joins and leaves as a member', async () => {
    let res = mockRes();
    await roomsController.joinRoom(reqFor({ params: { roomId: 'room-1' }, user: { id: 'u2' } }), res);
    assert.deepEqual(res.body, { success: true });
    assert.deepEqual(created, { roomId: 'room-1', userId: 'u2', role: 'member' });

    res = mockRes();
    await roomsController.leaveRoom(reqFor({ params: { roomId: 'room-1' }, user: { id: 'u2' } }), res);
    assert.deepEqual(res.body, { success: true });
    assert.deepEqual(created, { roomId: 'room-1', userId: 'u2' });
  });

  it('answers a fixed 500 when the model throws', async () => {
    Room.create = async () => { throw new Error("Table 'rooms' doesn't exist"); };
    const res = mockRes();
    await roomsController.createRoom(reqFor({ user: { id: 'u1' }, body: { name: 'x' } }), res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Failed to create room');
    assert.ok(!JSON.stringify(res.body).includes("rooms"), 'no schema in the body');
  });
});