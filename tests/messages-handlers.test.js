// tests/messages-handlers.test.js
// Chat access-control and message-lifecycle rules: participant verification
// before delete, the 15-minute windows, ownership on edit, and the code-based
// failure mapping for sends. Real controller with stubbed Message/GroupMember.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-messages';

const pool = require('../backend/config/database');
const Message = require('../backend/models/Message');
const GroupMember = require('../backend/models/GroupMember');
const messages = require('../backend/controllers/messages.controller');

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
  user: { user_id: 'me', id: 'me', username: 'me' },
  app: { get: () => null },
  ...over,
});

describe('conversation reads', () => {
  let fake;
  afterEach(() => fake?.restore());

  it('returns messages with the unread anchor', async () => {
    Message.getMessages = async () => ({
      chatId: 'chat-1', messages: [{ message_id: 'm1' }], hasMore: false, nextCursor: null,
    });
    fake = installFakePool(async (sql) => {
      if (sql.startsWith('SELECT chat_id FROM personal_chats')) return [[{ chat_id: 'chat-1' }]];
      if (sql.includes('MIN(m.server_sequence)')) return [[{ unread: 3, first_seq: 12 }]];
      if (sql.startsWith('SELECT message_id FROM messages')) return [[{ message_id: 'm-anchor' }]];
      return [[], []];
    });

    const res = mockRes();
    await messages.getConversationMessages(reqFor({ params: { chatId: 'chat-1' } }), res);

    assert.equal(res.body.status, 'success');
    assert.deepEqual(res.body.data, [{ message_id: 'm1' }]);
    assert.equal(res.body.unreadCount, 3);
    assert.equal(res.body.firstUnreadSeq, 12);
    assert.equal(res.body.firstUnreadId, 'm-anchor');
  });

  it('skips the unread probe for group chats', async () => {
    Message.getMessages = async () => ({ chatId: 'chat-1', messages: [], hasMore: false, nextCursor: null });
    fake = installFakePool(async () => [[], []]);

    const res = mockRes();
    await messages.getConversationMessages(reqFor({ params: { chatId: 'chat-1' } }), res);

    assert.equal(res.body.unreadCount, 0);
    assert.equal(res.body.firstUnreadSeq, null);
  });

  it('404s a conversation the model rejects', async () => {
    const err = new Error('nope');
    err.statusCode = 404;
    Message.getMessages = async () => { throw err; };
    fake = installFakePool(async () => [[], []]);

    const res = mockRes();
    await messages.getConversationMessages(reqFor({ params: { chatId: 'x' } }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Conversation not found.');
  });

  it('500s with a fixed message otherwise', async () => {
    Message.getMessages = async () => { throw new Error("Table 'messages' doesn't exist"); };
    fake = installFakePool(async () => [[], []]);

    const res = mockRes();
    await messages.getConversationMessages(reqFor({ params: { chatId: 'x' } }), res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Something went wrong while loading messages.');
    assert.ok(!JSON.stringify(res.body).includes("personal_chats"), 'no schema in the body');
  });
});

describe('sendMessage validation and failure mapping', () => {
  beforeEach(() => {
    Message.sendMessage = async () => 'msg-1';
  });

  it('400s without content or media', async () => {
    const res = mockRes();
    await messages.sendMessage(reqFor({ body: { recipientId: 'them' } }), res);
    assert.equal(res.statusCode, 400);
  });

  it('400s without a recipient or chat', async () => {
    const res = mockRes();
    await messages.sendMessage(reqFor({ body: { content: 'hi' } }), res);
    assert.equal(res.statusCode, 400);
  });

  it('sends and returns the message id', async () => {
    let seen = null;
    Message.sendMessage = async (payload) => { seen = payload; return 'msg-9'; };

    const res = mockRes();
    await messages.sendMessage(reqFor({ body: { content: 'hi', partnerId: 'them' } }), res);

    assert.deepEqual(res.body, { status: 'success', data: { messageId: 'msg-9' } });
    assert.equal(seen.senderId, 'me');
    assert.equal(seen.recipientId, 'them');
  });

  it('403s MESSAGE_BLOCKED with the conversation reason', async () => {
    const err = new Error('blocked');
    err.code = 'MESSAGE_BLOCKED';
    Message.sendMessage = async () => { throw err; };

    const res = mockRes();
    await messages.sendMessage(reqFor({ body: { content: 'hi', partnerId: 'them' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'MESSAGE_BLOCKED');
  });

  it('404s CHAT_NOT_FOUND', async () => {
    const err = new Error('no chat');
    err.code = 'CHAT_NOT_FOUND';
    Message.sendMessage = async () => { throw err; };

    const res = mockRes();
    await messages.sendMessage(reqFor({ body: { content: 'hi', chatId: 'ghost' } }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.code, 'CHAT_NOT_FOUND');
  });

  it('400s INVALID_MEDIA_URL', async () => {
    const err = new Error('bad url');
    err.code = 'INVALID_MEDIA_URL';
    Message.sendMessage = async () => { throw err; };

    const res = mockRes();
    await messages.sendMessage(reqFor({ body: { media_url: 'http://evil/x', partnerId: 'them' } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'INVALID_MEDIA_URL');
  });

  it('500s generically on an unmapped failure', async () => {
    Message.sendMessage = async () => { throw new Error("Table 'personal_chats' doesn't exist"); };
    const res = mockRes();
    await messages.sendMessage(reqFor({ body: { content: 'hi', partnerId: 'them' } }), res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Something went wrong. Please try again.');
  });
});

describe('deleteMessage — participant and window rules', () => {
  beforeEach(() => {
    Message.deleteForMe = async () => ({ scope: 'me' });
    Message.deleteForEveryone = async () => ({ scope: 'everyone' });
  });

  const baseMsg = (over = {}) => ({
    message_id: 'm1',
    sender_id: 'me',
    chat_id: 'chat-1',
    sent_at: new Date().toISOString(),
    ...over,
  });

  it('404s a missing message', async () => {
    Message.getById = async () => null;
    const res = mockRes();
    await messages.deleteMessage(reqFor({ params: { messageId: 'm1' }, body: { forEveryone: true } }), res);
    assert.equal(res.statusCode, 404);
  });

  it('403s a non-participant before touching anything', async () => {
    Message.getById = async () => baseMsg();
    GroupMember.isParticipant = async () => false;

    const res = mockRes();
    await messages.deleteMessage(reqFor({ params: { messageId: 'm1' }, body: { forEveryone: false } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'User not part of this chat');
  });

  it('delete-for-me needs no ownership', async () => {
    Message.getById = async () => baseMsg({ sender_id: 'someone-else' });
    GroupMember.isParticipant = async () => true;

    const res = mockRes();
    await messages.deleteMessage(reqFor({ params: { messageId: 'm1' }, body: { forEveryone: false } }), res);
    assert.deepEqual(res.body, { status: 'success', message: 'Deleted for me' });
  });

  it('own message within the window deletes for everyone', async () => {
    Message.getById = async () => baseMsg();
    GroupMember.isParticipant = async () => true;

    const res = mockRes();
    await messages.deleteMessage(reqFor({ params: { messageId: 'm1' }, body: { forEveryone: true } }), res);
    assert.equal(res.body.message, 'Deleted for everyone');
  });

  it('own message past 15 minutes is refused', async () => {
    const old = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    Message.getById = async () => baseMsg({ sent_at: old });
    GroupMember.isParticipant = async () => true;

    const res = mockRes();
    await messages.deleteMessage(reqFor({ params: { messageId: 'm1' }, body: { forEveryone: true } }), res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /Delete window expired/);
  });

  it('a group admin can delete someone else\u2019s message', async () => {
    Message.getById = async () => baseMsg({ sender_id: 'other' });
    GroupMember.isParticipant = async () => true;
    GroupMember.isAdmin = async () => true;

    const res = mockRes();
    await messages.deleteMessage(
      reqFor({ params: { messageId: 'm1' }, body: { forEveryone: true, chatId: 'group-1' } }),
      res
    );
    assert.equal(res.body.message, 'Deleted for everyone');
  });

  it('a plain member cannot delete someone else\u2019s message', async () => {
    Message.getById = async () => baseMsg({ sender_id: 'other' });
    GroupMember.isParticipant = async () => true;
    GroupMember.isAdmin = async () => false;

    const res = mockRes();
    await messages.deleteMessage(
      reqFor({ params: { messageId: 'm1' }, body: { forEveryone: true, chatId: 'group-1' } }),
      res
    );
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'Permission denied or delete failed');
  });
});

describe('editMessage', () => {
  it('400s empty content', async () => {
    const res = mockRes();
    await messages.editMessage(reqFor({ params: { messageId: 'm1' }, body: { content: '  ' } }), res);
    assert.equal(res.statusCode, 400);
  });

  it('403s an expired edit window', async () => {
    Message.editMessage = async () => ({ code: 'EDIT_WINDOW_EXPIRED' });
    const res = mockRes();
    await messages.editMessage(reqFor({ params: { messageId: 'm1' }, body: { content: 'fixed' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'EDIT_WINDOW_EXPIRED');
  });

  it('403s editing someone else\u2019s message', async () => {
    Message.editMessage = async () => null;
    const res = mockRes();
    await messages.editMessage(reqFor({ params: { messageId: 'm1' }, body: { content: 'hijack' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'Cannot edit message (not yours)');
  });

  it('trims and succeeds for the author', async () => {
    let seen = null;
    Message.editMessage = async (messageId, userId, content) => {
      seen = { messageId, userId, content };
      return { chatId: 'chat-1' };
    };

    const res = mockRes();
    await messages.editMessage(reqFor({ params: { messageId: 'm1' }, body: { content: '  fixed typo  ' } }), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen, { messageId: 'm1', userId: 'me', content: 'fixed typo' });
  });
});

describe('reactions and mute', () => {
  beforeEach(() => {
    Message.addReaction = async () => ({ action: 'added' });
    Message.removeReaction = async () => ({ action: 'removed' });
    Message.muteConversation = async () => ({ muted: true });
  });

  it('requires an emoji to add a reaction', async () => {
    const res = mockRes();
    await messages.reactToMessage(reqFor({ params: { messageId: 'm1' }, body: {} }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'emoji required');
  });

  it('adds and removes reactions', async () => {
    let res = mockRes();
    await messages.reactToMessage(reqFor({ params: { messageId: 'm1' }, body: { emoji: '🔥' } }), res);
    assert.deepEqual(res.body, { status: 'success', data: { action: 'added' } });

    res = mockRes();
    await messages.reactToMessage(reqFor({ params: { messageId: 'm1' }, body: { remove: true } }), res);
    assert.deepEqual(res.body, { status: 'success', data: { action: 'removed' } });
  });

  it('mute defaults to on and only false unmutes', async () => {
    let seen = null;
    Message.muteConversation = async (userId, chatId, muted) => { seen = { userId, chatId, muted }; return {}; };

    let res = mockRes();
    await messages.muteConversation(reqFor({ params: { chatId: 'c1' }, body: {} }), res);
    assert.equal(seen.muted, true);

    res = mockRes();
    await messages.muteConversation(reqFor({ params: { chatId: 'c1' }, body: { muted: false } }), res);
    assert.equal(seen.muted, false);
  });
});