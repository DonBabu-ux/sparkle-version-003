// tests/posts-handlers.test.js
// Core content-surface behavior: create validation, ownership gates on update/
// delete (author / group-admin / global admin), comment moderation rules, and
// the toggle-action response mapping. Real handlers with a fake pool.query and
// stubbed model singletons.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-posts';

const pool = require('../backend/config/database');
const Post = require('../backend/models/Post');
const Group = require('../backend/models/Group');
const MomentsController = require('../backend/controllers/moments.controller');
const postController = require('../backend/controllers/post.controller');

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
  body: {}, params: {}, query: {}, headers: {}, cookies: {}, files: [],
  user: { user_id: 'author-1', userId: 'author-1', role: 'user', campus: 'main' },
  ...over,
});

const post = (over = {}) => ({
  post_id: 'p1',
  user_id: 'author-1',
  content: 'hello world',
  group_id: null,
  ...over,
});

describe('createPost', () => {
  let fake;
  afterEach(() => fake?.restore());

  beforeEach(() => {
    Post.create = async () => 'p-new';
    Post.extractAndHandleMentions = async () => ({ notified: 0 });
    fake = installFakePool(async () => [[], []]);
  });

  it('creates a text post', async () => {
    const seen = [];
    Post.create = async (userId, data) => { seen.push({ userId, data }); return 'p-new'; };

    const res = mockRes();
    await postController.createPost(reqFor({ body: { content: 'hello world' } }), res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.post_id, 'p-new');
    assert.equal(seen[0].userId, 'author-1');
    assert.equal(seen[0].data.content, 'hello world');
  });

  it('rejects a post with neither text nor media', async () => {
    const res = mockRes();
    await postController.createPost(reqFor({ body: {} }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'A post needs either text or media.');
  });

  it('rejects whitespace-only content', async () => {
    const res = mockRes();
    await postController.createPost(reqFor({ body: { content: '   ' } }), res);
    assert.equal(res.statusCode, 400);
  });

  it('routes a video post to the moments controller', async () => {
    let seen = null;
    MomentsController.createMoment = async (req, res) => {
      seen = { caption: req.body.caption, media_url: req.body.media_url };
      res.json({ routed: true });
    };

    const res = mockRes();
    await postController.createPost(
      reqFor({ body: { content: 'my clip', media_url: 'https://cdn/clip.mp4', media_type: 'video' } }),
      res
    );

    assert.deepEqual(seen, { caption: 'my clip', media_url: 'https://cdn/clip.mp4' });
    assert.deepEqual(res.body, { routed: true });
  });

  it('answers a fixed 500 when the model throws', async () => {
    Post.create = async () => { throw new Error("Table 'posts' doesn't exist"); };
    const res = mockRes();
    await postController.createPost(reqFor({ body: { content: 'hello' } }), res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Failed to create post');
    assert.ok(!JSON.stringify(res.body).includes("posts"), 'no schema in the body');
  });
});

describe('updatePost — ownership gate', () => {
  let fake;
  afterEach(() => fake?.restore());

  beforeEach(() => {
    Post.update = async () => true;
    fake = installFakePool(async () => [[], []]);
  });

  it('updates as the author', async () => {
    let seen = null;
    Post.update = async (postId, userId, updates) => { seen = { postId, userId, updates }; return true; };

    const res = mockRes();
    await postController.updatePost(
      reqFor({ params: { id: 'p1' }, body: { content: 'edited' } }),
      res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen, {
      postId: 'p1',
      userId: 'author-1',
      updates: { content: 'edited', post_type: undefined, feeling: undefined, activity: undefined, tagged_users: undefined },
    });
  });

  it('403s when the model refuses (wrong author or missing post)', async () => {
    Post.update = async () => false;
    const res = mockRes();
    await postController.updatePost(reqFor({ params: { id: 'p1' }, body: { content: 'edited' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'Unauthorized or post not found');
  });

  it('honours remove_media', async () => {
    let seen = null;
    Post.update = async (postId, userId, updates) => { seen = updates; return true; };
    const res = mockRes();
    await postController.updatePost(
      reqFor({ params: { id: 'p1' }, body: { remove_media: 'true', content: 'text only now' } }),
      res
    );
    assert.deepEqual(seen.media, []);
  });
});

describe('deletePost — three-tier authorization', () => {
  let fake;
  afterEach(() => fake?.restore());

  beforeEach(() => {
    Post.findById = async () => post();
    Post.delete = async () => true;
    Group.getMember = async () => null;
    fake = installFakePool(async () => [[], []]);
  });

  it('404s a missing post', async () => {
    Post.findById = async () => null;
    const res = mockRes();
    await postController.deletePost(reqFor({ params: { id: 'ghost' } }), res);
    assert.equal(res.statusCode, 404);
  });

  it('deletes as the author', async () => {
    let seen = null;
    Post.delete = async (postId, authorId) => { seen = { postId, authorId }; return true; };
    const res = mockRes();
    await postController.deletePost(reqFor({ params: { id: 'p1' } }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen, { postId: 'p1', authorId: 'author-1' });
  });

  it('403s a stranger on a normal post', async () => {
    Post.findById = async () => post({ user_id: 'someone-else' });
    const res = mockRes();
    await postController.deletePost(reqFor({ params: { id: 'p1' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'Unauthorized to delete this post');
  });

  it('authorizes a group moderator', async () => {
    Post.findById = async () => post({ user_id: 'someone-else', group_id: 'g1' });
    Group.getMember = async () => ({ role: 'moderator' });
    const res = mockRes();
    await postController.deletePost(reqFor({ params: { id: 'p1' } }), res);
    assert.equal(res.statusCode, 200);
  });

  it('does not authorize an ordinary group member', async () => {
    Post.findById = async () => post({ user_id: 'someone-else', group_id: 'g1' });
    Group.getMember = async () => ({ role: 'member' });
    const res = mockRes();
    await postController.deletePost(reqFor({ params: { id: 'p1' } }), res);
    assert.equal(res.statusCode, 403);
  });

  it('authorizes a global admin', async () => {
    Post.findById = async () => post({ user_id: 'someone-else' });
    const res = mockRes();
    await postController.deletePost(reqFor({ params: { id: 'p1' }, user: { user_id: 'admin-1', role: 'admin' } }), res);
    assert.equal(res.statusCode, 200);
  });
});

describe('comments', () => {
  let fake;
  afterEach(() => fake?.restore());

  beforeEach(() => {
    Post.addComment = async () => ({ commentId: 'c-new' });
    Post.findById = async () => post();
    Post.getCommentById = async () => ({ comment_id: 'c1', post_id: 'p1', user_id: 'author-1' });
    Post.updateComment = async () => true;
    Post.deleteComment = async () => true;
    Group.getMember = async () => null;
    fake = installFakePool(async () => [[], []]);
  });

  it('adds a comment', async () => {
    let seen = null;
    Post.addComment = async (postId, userId, content, parentId) => {
      seen = { postId, userId, content, parentId };
      return { commentId: 'c-new' };
    };
    const res = mockRes();
    await postController.addComment(reqFor({ params: { id: 'p1' }, body: { content: 'nice!', parent_comment_id: 'c0' } }), res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.comment_id, 'c-new');
    assert.deepEqual(seen, { postId: 'p1', userId: 'author-1', content: 'nice!', parentId: 'c0' });
  });

  it('400s an empty comment', async () => {
    const res = mockRes();
    await postController.addComment(reqFor({ params: { id: 'p1' }, body: { content: '   ' } }), res);
    assert.equal(res.statusCode, 400);
  });

  it('surfaces a comments-disabled post as a 500 (model throws, not 4xx)', async () => {
    Post.addComment = async () => { throw new Error('Comments are disabled for this post.'); };
    const res = mockRes();
    await postController.addComment(reqFor({ params: { id: 'p1' }, body: { content: 'hi' } }), res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Failed to add comment');
  });

  it('404s an unknown comment before the auth checks', async () => {
    Post.getCommentById = async () => null;
    const res = mockRes();
    await postController.deleteComment(reqFor({ params: { id: 'ghost' } }), res);
    assert.equal(res.statusCode, 404);
  });

  it('403s deleting someone else\u2019s comment', async () => {
    Post.deleteComment = async () => false;
    const res = mockRes();
    await postController.deleteComment(reqFor({ params: { id: 'c1' } }), res);
    assert.equal(res.statusCode, 403);
  });

  it('only the author may edit a comment', async () => {
    let seen = null;
    Post.updateComment = async (commentId, userId, content) => {
      seen = { commentId, userId, content };
      return userId === 'author-1';
    };

    let res = mockRes();
    await postController.updateComment(reqFor({ params: { id: 'c1' }, body: { content: 'fixed typo' } }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen, { commentId: 'c1', userId: 'author-1', content: 'fixed typo' });

    Post.updateComment = async () => false;
    res = mockRes();
    await postController.updateComment(reqFor({ params: { id: 'c1' }, body: { content: 'hijack' }, user: { user_id: 'other' } }), res);
    assert.equal(res.statusCode, 403);
  });

  it('passes empty content straight through to the model (blanks the comment)', async () => {
    let seen = null;
    Post.updateComment = async (commentId, userId, content) => { seen = content; return true; };
    const res = mockRes();
    await postController.updateComment(reqFor({ params: { id: 'c1' }, body: { content: '' } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(seen, '');
  });
});

describe('toggle actions', () => {
  let fake;
  beforeEach(() => {
    Post.addSpark = async () => ({ action: 'sparked' });
    Post.toggleSave = async () => ({ action: 'saved' });
    Post.reshare = async () => ({ repostId: 'r1' });
    Post.incrementShare = async () => true;
    Post.recordAction = async () => ({ ok: true });
    Post.findById = async () => post();
    fake = installFakePool(async () => [[], []]);
  });
  afterEach(() => fake?.restore());

  it('spark toggles between the two messages', async () => {
    let res = mockRes();
    await postController.sparkPost(reqFor({ params: { id: 'p1' } }), res);
    assert.equal(res.body.message, 'Post sparked!');

    Post.addSpark = async () => ({ action: 'unsparked' });
    res = mockRes();
    await postController.sparkPost(reqFor({ params: { id: 'p1' } }), res);
    assert.equal(res.body.message, 'Spark removed');
  });

  it('save reports bookmark state', async () => {
    const res = mockRes();
    await postController.savePost(reqFor({ params: { id: 'p1' } }), res);
    assert.equal(res.body.message, 'Post saved to bookmarks!');

    Post.toggleSave = async () => ({ action: 'unsaved' });
    const res2 = mockRes();
    await postController.savePost(reqFor({ params: { id: 'p1' } }), res2);
    assert.equal(res2.body.message, 'Post removed from bookmarks');
  });

  it('reshare answers 201 even when the model actually unreshared', async () => {
    Post.reshare = async () => ({ action: 'unreposted' });
    const res = mockRes();
    await postController.resharePost(reqFor({ params: { id: 'p1' }, body: { comment: 'again' } }), res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.message, 'Post reshared successfully');
    assert.equal(res.body.post_id, 'p1');
  });

  it('share increments and acknowledges', async () => {
    let called = false;
    Post.incrementShare = async () => { called = true; return true; };
    const res = mockRes();
    await postController.sharePost(reqFor({ params: { id: 'p1' } }), res);
    assert.deepEqual(res.body, { message: 'Post share count updated' });
    assert.ok(called);
  });

  it('logAction acknowledges without waiting for the write', async () => {
    const res = mockRes();
    await postController.logAction(reqFor({ params: { id: 'p1' }, body: { action_type: 'view', duration: 3 } }), res);
    assert.deepEqual(res.body, { success: true });
  });
});