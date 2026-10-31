// tests/mediaDeletionCleanup.test.js
// Residue-free deletion contracts: Cloudinary byte cleanup and registry
// removal for posts/stories, plus the hourly residue sweeps. Pure parsing
// logic runs directly; DB-touching paths use a fake pool.query router and a
// mocked cloudinary.uploader.destroy — no live DB, no live Cloudinary.
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// Models/controllers load the auth config, which refuses to boot without a secret.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-residue-only';

const pool = require('../backend/config/database');
const cloudinary = require('cloudinary').v2;
const MediaService = require('../backend/services/media.service');
const Post = require('../backend/models/Post');
const Group = require('../backend/models/Group');
const feed = require('../backend/controllers/feed.controller');
const residueJob = require('../backend/jobs/residue-cleanup.job');

const CLOUD = 'https://res.cloudinary.com/demo';
const imgUrl = (id, version = 1761425981) => `${CLOUD}/image/upload/v${version}/sparkle_posts/${id}.jpg`;
const vidUrl = (id, version = 1761425981) => `${CLOUD}/video/upload/v${version}/sparkle_stories/${id}.mp4`;

// ── fake pool.query router (mirrors tests/clubs-groups-routes.test.js) ──────
function installFakePool(impl) {
    const calls = [];
    const original = pool.query;
    pool.query = async (sql, params = []) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ sql: text, params });
        return impl(text, params);
    };
    return { calls, restore() { pool.query = original; } };
}

// Translates a MySQL LIKE pattern (ESCAPE '|') into a RegExp for matching.
function likeToRegExp(pattern) {
    const escape = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let out = '';
    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];
        if (ch === '|' && i + 1 < pattern.length) { out += escape(pattern[++i]); continue; }
        if (ch === '%') { out += '.*'; continue; }
        if (ch === '_') { out += '.'; continue; }
        out += escape(ch);
    }
    return new RegExp(`^${out}$`);
}

// ── in-memory store modelling only the surfaced rows ─────────────────────────
function makeStore(initial = {}) {
    return {
        posts: initial.posts || [],          // { post_id, media_url }
        postMedia: initial.postMedia || [],  // { media_id, post_id, media_url }
        stories: initial.stories || [],      // { story_id, media_url, thumbnail_url, audio_url }
        savedPosts: initial.savedPosts || [],// { id, post_id }
        notifications: initial.notifications || [], // { notification_id, related_type, related_id }
        registry: initial.registry || []     // { media_id, cloudinary_public_id, category, secure_url }
    };
}

/**
 * Routes SQL against the store. Unrecognised statements return an empty
 * result set so a missing route shows up as a failing assertion.
 */
function storeRouter(store) {
    const affected = (before, after) => [{ affectedRows: before - after }];
    return (text, params = []) => {
        // ── reads ──
        if (text === 'SELECT media_url FROM posts WHERE post_id = ?') {
            return [[store.posts.find((p) => p.post_id === params[0]) || null].filter(Boolean)];
        }
        if (text === 'SELECT media_url FROM post_media WHERE post_id = ?') {
            return [store.postMedia.filter((m) => m.post_id === params[0])];
        }
        if (text === 'SELECT media_url, thumbnail_url, audio_url FROM stories WHERE story_id = ? AND user_id = ?') {
            return [[store.stories.find((s) => s.story_id === params[0]) || null].filter(Boolean)];
        }
        if (text === 'SELECT media_id, cloudinary_public_id FROM media_registry WHERE cloudinary_public_id = ?') {
            return [store.registry.filter((r) => r.cloudinary_public_id === params[0])];
        }
        if (text.startsWith('SELECT 1 FROM media_registry WHERE cloudinary_public_id = ?')) {
            const [publicId, ...excluded] = params;
            const hit = store.registry.some(
                (r) => r.cloudinary_public_id === publicId && !excluded.includes(r.media_id)
            );
            return [hit ? [1] : []];
        }
        if (text.startsWith('SELECT 1 FROM posts WHERE media_url LIKE')) {
            const re = likeToRegExp(params[0]);
            return [store.posts.some((p) => p.media_url && re.test(p.media_url)) ? [1] : []];
        }
        if (text.startsWith('SELECT 1 FROM post_media WHERE media_url LIKE')) {
            const re = likeToRegExp(params[0]);
            return [store.postMedia.some((m) => re.test(m.media_url)) ? [1] : []];
        }
        if (text.startsWith('SELECT 1 FROM stories WHERE')) {
            const re = likeToRegExp(params[0]);
            return [store.stories.some(
                (s) => [s.media_url, s.thumbnail_url, s.audio_url].some((u) => u && re.test(u))
            ) ? [1] : []];
        }
        if (text.startsWith('SELECT sp.id FROM saved_posts sp')) {
            return [store.savedPosts
                .filter((s) => !store.posts.some((p) => p.post_id === s.post_id))
                .map((s) => ({ id: s.id }))];
        }
        if (text.startsWith('SELECT notification_id FROM notifications WHERE related_id IS NOT NULL')) {
            return [store.notifications
                .filter((n) => n.related_id != null && (n.related_type === 'post'
                    ? !store.posts.some((p) => p.post_id === n.related_id)
                    : n.related_type === 'story' && !store.stories.some((s) => s.story_id === n.related_id)))
                .map((n) => ({ notification_id: n.notification_id }))];
        }
        if (text.includes('FROM media_registry WHERE category =')) {
            const category = /category = '(\w+)'/.exec(text)[1];
            return [store.registry
                .filter((r) => (r.category || 'post') === category)
                .map((r) => ({ media_id: r.media_id, cloudinary_public_id: r.cloudinary_public_id, secure_url: r.secure_url }))];
        }

        // ── deletes ──
        if (text.startsWith('DELETE FROM posts WHERE post_id = ?')) {
            const before = store.posts.length;
            store.posts = store.posts.filter((p) => p.post_id !== params[0]);
            // post_media cascades (FK ON DELETE CASCADE); saved_posts and
            // notifications have no FK and must be deleted by the code under test.
            store.postMedia = store.postMedia.filter((m) => m.post_id !== params[0]);
            return affected(before, store.posts.length);
        }
        if (text === 'DELETE FROM saved_posts WHERE post_id = ?') {
            const before = store.savedPosts.length;
            store.savedPosts = store.savedPosts.filter((s) => s.post_id !== params[0]);
            return affected(before, store.savedPosts.length);
        }
        if (text === 'DELETE FROM saved_posts WHERE id IN (?)') {
            const before = store.savedPosts.length;
            store.savedPosts = store.savedPosts.filter((s) => !params[0].includes(s.id));
            return affected(before, store.savedPosts.length);
        }
        if (text.startsWith("DELETE FROM notifications WHERE related_type = 'post' AND related_id = ?")) {
            const before = store.notifications.length;
            store.notifications = store.notifications.filter(
                (n) => !(n.related_type === 'post' && n.related_id === params[0])
            );
            return affected(before, store.notifications.length);
        }
        if (text === 'DELETE FROM notifications WHERE notification_id IN (?)') {
            const before = store.notifications.length;
            store.notifications = store.notifications.filter((n) => !params[0].includes(n.notification_id));
            return affected(before, store.notifications.length);
        }
        if (text.startsWith('DELETE FROM stories WHERE story_id')) {
            const before = store.stories.length;
            store.stories = store.stories.filter((s) => s.story_id !== params[0]);
            return affected(before, store.stories.length);
        }
        if (text.startsWith('DELETE FROM media_registry WHERE media_id IN')) {
            const before = store.registry.length;
            store.registry = store.registry.filter((r) => !params[0].includes(r.media_id));
            return affected(before, store.registry.length);
        }
        if (text === 'DELETE FROM media_registry WHERE media_id = ?') {
            const before = store.registry.length;
            store.registry = store.registry.filter((r) => r.media_id !== params[0]);
            return affected(before, store.registry.length);
        }

        return [[]];
    };
}

// ── cloudinary.uploader.destroy mock ────────────────────────────────────────
let destroyCalls = [];
let destroyImpl = async () => ({ result: 'ok' });
const originalDestroy = cloudinary.uploader.destroy;
const resetDestroy = () => {
    destroyCalls = [];
    destroyImpl = async () => ({ result: 'ok' });
};

before(() => {
    cloudinary.uploader.destroy = async (publicId, options) => {
        destroyCalls.push({ publicId, options });
        return destroyImpl(publicId, options);
    };
});

after(() => {
    cloudinary.uploader.destroy = originalDestroy;
});

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

describe('extractCloudinaryRef — secure_url parsing', () => {
    it('parses an image URL with a version segment into the registry public id', () => {
        assert.deepEqual(
            MediaService.extractCloudinaryRef(`${CLOUD}/image/upload/v1761425981/sparkle_posts/abc123.jpg`),
            { publicId: 'sparkle_posts/abc123', resourceType: 'image', version: '1761425981' }
        );
    });

    it('parses a video URL and reports the video resource type', () => {
        const ref = MediaService.extractCloudinaryRef(`${CLOUD}/video/upload/v1761425981/sparkle_stories/xyz.mp4`);
        assert.equal(ref.resourceType, 'video');
        assert.equal(ref.publicId, 'sparkle_stories/xyz');
        assert.equal(ref.version, '1761425981');
    });

    it('handles URLs without a version segment', () => {
        assert.deepEqual(
            MediaService.extractCloudinaryRef(`${CLOUD}/image/upload/sparkle_posts/no_version.png`),
            { publicId: 'sparkle_posts/no_version', resourceType: 'image', version: null }
        );
    });

    it('tolerates transformation prefixes on trimmed story videos', () => {
        const ref = MediaService.extractCloudinaryRef(`${CLOUD}/video/upload/so_5,du_10/v1761425981/sparkle_stories/trimmed.mp4`);
        assert.equal(ref.publicId, 'sparkle_stories/trimmed');
        assert.equal(ref.version, '1761425981');
    });

    it('keeps nested public ids intact (only the first version segment is stripped)', () => {
        const ref = MediaService.extractCloudinaryRef(`${CLOUD}/image/upload/v123/sparkle/posts/v2/abc.jpg`);
        assert.equal(ref.publicId, 'sparkle/posts/v2/abc');
        assert.equal(ref.version, '123');
    });

    it('returns null for data: URIs', () => {
        assert.equal(MediaService.extractCloudinaryRef('data:image/png;base64,iVBORw0KGgo='), null);
    });

    it('returns null for non-Cloudinary hosts', () => {
        assert.equal(MediaService.extractCloudinaryRef('https://images.unsplash.com/photo-123?w=300'), null);
        assert.equal(MediaService.extractCloudinaryRef('https://cdn.deezer.com/preview/track.mp3'), null);
    });

    it('returns null for local upload paths and junk input', () => {
        assert.equal(MediaService.extractCloudinaryRef('/uploads/avatars/no-profile.png'), null);
        assert.equal(MediaService.extractCloudinaryRef(null), null);
        assert.equal(MediaService.extractCloudinaryRef(''), null);
        assert.equal(MediaService.extractCloudinaryRef(42), null);
    });
});

describe('urlReferencesPublicId — version-agnostic URL matching', () => {
    it('matches a URL for the same public id regardless of version segment', () => {
        assert.ok(MediaService.urlReferencesPublicId(imgUrl('abc123', 9), 'sparkle_posts/abc123'));
    });

    it('does not match a different public id that merely shares a prefix', () => {
        assert.equal(MediaService.urlReferencesPublicId(imgUrl('abc1234'), 'sparkle_posts/abc123'), false);
    });

    it('returns false for junk input', () => {
        assert.equal(MediaService.urlReferencesPublicId(null, 'sparkle_posts/abc123'), false);
        assert.equal(MediaService.urlReferencesPublicId(imgUrl('abc123'), null), false);
    });
});

describe('escapeLike — LIKE wildcard escaping', () => {
    it('escapes _ and % so sibling assets cannot false-match', () => {
        assert.equal(MediaService.escapeLike('posts/ab_c%d'), 'posts/ab|_c|%d');
    });
});

describe('deleteMediaForUrls — destroy + registry cleanup', () => {
    let fake;
    let store;

    beforeEach(() => {
        resetDestroy();
        store = makeStore();
        fake = installFakePool(storeRouter(store));
    });

    afterEach(() => { fake.restore(); resetDestroy(); });

    it('destroys an unreferenced asset and deletes its registry rows', async () => {
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'sparkle_posts/p1', category: 'post', secure_url: imgUrl('p1') });

        const summary = await MediaService.deleteMediaForUrls([imgUrl('p1')]);

        assert.deepEqual(summary, { destroyed: 1, kept: 0, errors: [] });
        assert.equal(destroyCalls.length, 1);
        assert.deepEqual(destroyCalls[0], {
            publicId: 'sparkle_posts/p1',
            options: { resource_type: 'image' }
        });
        assert.deepEqual(store.registry, []);
    });

    it('skips the destroy and keeps the registry row when a live story still references it', async () => {
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'sparkle_stories/s1', category: 'story', secure_url: vidUrl('s1') });
        // An older-version URL proves the reference check is version-agnostic.
        store.stories.push({ story_id: 's-1', media_url: vidUrl('s1', 42), thumbnail_url: null, audio_url: null });

        const summary = await MediaService.deleteMediaForUrls([vidUrl('s1')]);

        assert.equal(summary.destroyed, 0);
        assert.equal(summary.kept, 1);
        assert.equal(destroyCalls.length, 0);
        assert.equal(store.registry.length, 1);
    });

    it('reclaims duplicate registry rows for one public id (both rows are deletion candidates)', async () => {
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'sparkle_posts/p1', category: 'post', secure_url: imgUrl('p1') });
        store.registry.push({ media_id: 'm-2', cloudinary_public_id: 'sparkle_posts/p1', category: 'post', secure_url: imgUrl('p1') });

        const summary = await MediaService.deleteMediaForUrls([imgUrl('p1')]);

        assert.equal(summary.destroyed, 1);
        assert.equal(summary.kept, 0);
        assert.equal(destroyCalls.length, 1);
        assert.equal(store.registry.length, 0);
    });

    it('dedupes media_url + derived thumbnail_url of the same story into one destroy', async () => {
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'sparkle_stories/s1', category: 'story', secure_url: vidUrl('s1') });

        const summary = await MediaService.deleteMediaForUrls([vidUrl('s1'), vidUrl('s1', 7777)]);

        assert.equal(summary.destroyed, 1);
        assert.equal(destroyCalls.length, 1);
    });

    it('ignores non-Cloudinary URLs without touching Cloudinary', async () => {
        const summary = await MediaService.deleteMediaForUrls([
            'data:image/png;base64,AAA',
            'https://images.unsplash.com/photo-1.jpg',
            null
        ]);

        assert.deepEqual(summary, { destroyed: 0, kept: 0, errors: [] });
        assert.equal(destroyCalls.length, 0);
    });

    it('records the error and keeps the registry row when destroy fails (never throws)', async () => {
        destroyImpl = async () => { throw new Error('cloudinary 500'); };
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'sparkle_posts/p1', category: 'post', secure_url: imgUrl('p1') });

        const summary = await MediaService.deleteMediaForUrls([imgUrl('p1')]);

        assert.equal(summary.destroyed, 0);
        assert.equal(summary.errors.length, 1);
        assert.match(summary.errors[0], /cloudinary 500/);
        // Registry row survives so a later sweep can retry.
        assert.equal(store.registry.length, 1);
    });

    it('returns an empty summary for a non-array input', async () => {
        assert.deepEqual(await MediaService.deleteMediaForUrls(null), { destroyed: 0, kept: 0, errors: [] });
    });
});

describe('Post.delete — full residue cleanup', () => {
    let fake;
    let store;

    const seed = () => {
        store = makeStore({
            posts: [{ post_id: 'post-1', media_url: imgUrl('p1') }],
            postMedia: [
                { media_id: 'pm-1', post_id: 'post-1', media_url: imgUrl('p2') },
                { media_id: 'pm-2', post_id: 'post-1', media_url: vidUrl('p3') }
            ],
            savedPosts: [{ id: 5, post_id: 'post-1' }],
            notifications: [
                { notification_id: 'n-1', related_type: 'post', related_id: 'post-1' },
                { notification_id: 'n-2', related_type: 'post', related_id: 'post-9' }
            ],
            registry: [
                { media_id: 'm-1', cloudinary_public_id: 'sparkle_posts/p1', category: 'post', secure_url: imgUrl('p1') },
                { media_id: 'm-2', cloudinary_public_id: 'sparkle_posts/p2', category: 'post', secure_url: imgUrl('p2') }
            ]
        });
        fake = installFakePool(storeRouter(store));
    };

    beforeEach(seed);
    afterEach(() => { fake.restore(); resetDestroy(); });

    it('deletes the post, its saved rows, its notifications and its Cloudinary bytes', async () => {
        const ok = await Post.delete('post-1', 'user-1');

        assert.equal(ok, true);
        const sql = fake.calls.map((c) => c.sql);
        assert.ok(sql.some((s) => s === 'DELETE FROM posts WHERE post_id = ? AND user_id = ?'), 'post row deleted');
        assert.ok(sql.some((s) => s === 'DELETE FROM saved_posts WHERE post_id = ?'), 'saved_posts cleaned');
        assert.ok(sql.some((s) => s.startsWith("DELETE FROM notifications WHERE related_type = 'post'")), 'notifications cleaned');
        assert.equal(store.savedPosts.length, 0);
        assert.equal(store.notifications.length, 1);
        assert.equal(store.notifications[0].related_id, 'post-9');
        const publicIds = destroyCalls.map((c) => c.publicId).sort();
        assert.deepEqual(publicIds, ['sparkle_posts/p1', 'sparkle_posts/p2', 'sparkle_stories/p3']);
        assert.deepEqual(store.registry, []);
    });

    it('reads media URLs BEFORE the post row is deleted (order contract)', async () => {
        await Post.delete('post-1', 'user-1');
        const readIdx = fake.calls.findIndex((c) => c.sql === 'SELECT media_url FROM post_media WHERE post_id = ?');
        const delIdx = fake.calls.findIndex((c) => c.sql === 'DELETE FROM posts WHERE post_id = ? AND user_id = ?');
        assert.ok(readIdx >= 0 && delIdx >= 0 && readIdx < delIdx, 'media_url read happens first');
    });

    it('still succeeds (returns true) when Cloudinary destroy fails', async () => {
        destroyImpl = async () => { throw new Error('cloudinary down'); };

        const ok = await Post.delete('post-1', 'user-1');

        assert.equal(ok, true);
        assert.equal(store.savedPosts.length, 0);
        assert.equal(store.notifications.filter((n) => n.related_id === 'post-1').length, 0);
    });

    it('returns false and cleans nothing when the post does not exist for the user', async () => {
        const ok = await Post.delete('missing-post', 'user-1');

        assert.equal(ok, false);
        assert.equal(store.savedPosts.length, 1);
        assert.equal(store.notifications.length, 2);
        assert.equal(destroyCalls.length, 0);
    });
});

describe('Group.deletePost — full residue cleanup', () => {
    let fake;
    let store;

    const seed = () => {
        store = makeStore({
            posts: [{ post_id: 'gp-1', media_url: imgUrl('g1') }],
            postMedia: [{ media_id: 'pm-1', post_id: 'gp-1', media_url: imgUrl('g2') }],
            savedPosts: [{ id: 9, post_id: 'gp-1' }],
            notifications: [{ notification_id: 'n-1', related_type: 'post', related_id: 'gp-1' }],
            registry: [{ media_id: 'm-1', cloudinary_public_id: 'sparkle_posts/g1', category: 'post', secure_url: imgUrl('g1') }]
        });
        fake = installFakePool(storeRouter(store));
    };

    beforeEach(seed);
    afterEach(() => { fake.restore(); resetDestroy(); });

    it('deletes the group post row, saved rows, notifications and bytes', async () => {
        const ok = await Group.deletePost('gp-1');

        assert.equal(ok, true);
        assert.equal(store.posts.length, 0);
        assert.equal(store.savedPosts.length, 0);
        assert.equal(store.notifications.length, 0);
        const publicIds = destroyCalls.map((c) => c.publicId).sort();
        assert.deepEqual(publicIds, ['sparkle_posts/g1', 'sparkle_posts/g2']);
        assert.equal(store.registry.length, 0);
    });

    it('still succeeds when Cloudinary destroy fails', async () => {
        destroyImpl = async () => { throw new Error('cloudinary down'); };

        const ok = await Group.deletePost('gp-1');

        assert.equal(ok, true);
        assert.equal(store.savedPosts.length, 0);
    });
});

describe('feed.deleteStory — media bytes + registry cleanup', () => {
    let fake;
    let store;

    const seed = () => {
        store = makeStore({
            stories: [{
                story_id: 'story-1',
                media_url: vidUrl('s1'),
                // Thumbnails are separate Cloudinary uploads with their own public id.
                thumbnail_url: `${CLOUD}/image/upload/v1/sparkle_stories/s1_thumb.jpg`,
                audio_url: 'https://cdn.deezer.com/preview/track.mp3'
            }],
            registry: [{ media_id: 'm-1', cloudinary_public_id: 'sparkle_stories/s1', category: 'story', secure_url: vidUrl('s1') }]
        });
        fake = installFakePool(storeRouter(store));
    };

    beforeEach(seed);
    afterEach(() => { fake.restore(); resetDestroy(); });

    it('destroys the story Cloudinary assets and drops the registry row', async () => {
        const res = mockRes();
        await feed.deleteStory({ params: { id: 'story-1' }, user: { userId: 'u-1' } }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(store.stories.length, 0);
        const publicIds = destroyCalls.map((c) => c.publicId).sort();
        assert.deepEqual(publicIds, ['sparkle_stories/s1', 'sparkle_stories/s1_thumb']);
        // External audio_url is not a Cloudinary asset — never destroyed.
        assert.ok(!destroyCalls.some((c) => String(c.publicId).includes('deezer')));
        assert.equal(store.registry.length, 0);
    });

    it('404s without touching media when the story is not the user’s', async () => {
        const res = mockRes();
        await feed.deleteStory({ params: { id: 'missing' }, user: { userId: 'u-1' } }, res);

        assert.equal(res.statusCode, 404);
        assert.equal(store.stories.length, 1);
        assert.equal(destroyCalls.length, 0);
    });

    it('still deletes the story when Cloudinary destroy fails', async () => {
        destroyImpl = async () => { throw new Error('cloudinary down'); };
        const res = mockRes();

        await feed.deleteStory({ params: { id: 'story-1' }, user: { userId: 'u-1' } }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(store.stories.length, 0);
    });
});

describe('residue sweeps — orphan rows and leaked media', () => {
    let fake;
    let store;

    beforeEach(() => {
        resetDestroy();
        store = makeStore();
        fake = installFakePool(storeRouter(store));
    });

    afterEach(() => { fake.restore(); resetDestroy(); });

    it('sweepOrphanSavedPosts removes saved rows whose post is gone', async () => {
        store.savedPosts.push({ id: 1, post_id: 'gone' }, { id: 2, post_id: 'alive' });
        store.posts.push({ post_id: 'alive', media_url: null });

        await residueJob.sweepOrphanSavedPosts();

        assert.deepEqual(store.savedPosts.map((s) => s.id), [2]);
    });

    it('sweepOrphanNotifications removes notifications with no live post', async () => {
        store.notifications.push(
            { notification_id: 'n-orphan', related_type: 'post', related_id: 'gone-post' },
            { notification_id: 'n-live', related_type: 'post', related_id: 'live-post' },
            { notification_id: 'n-null', related_type: 'post', related_id: null }
        );
        store.posts.push({ post_id: 'live-post', media_url: null });

        await residueJob.sweepOrphanNotifications();

        assert.deepEqual(store.notifications.map((n) => n.notification_id), ['n-live', 'n-null']);
    });

    it('sweepOrphanPostRegistry reclaims legacy post media with no live referencing row', async () => {
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'sparkle_posts/legacy', category: 'post', secure_url: imgUrl('legacy') });

        await residueJob.sweepOrphanPostRegistry();

        assert.equal(destroyCalls.length, 1);
        assert.equal(destroyCalls[0].publicId, 'sparkle_posts/legacy');
        assert.equal(store.registry.length, 0);
    });

    it('sweepOrphanPostRegistry keeps post media a live post still shows', async () => {
        store.posts.push({ post_id: 'p-1', media_url: imgUrl('legacy', 42) });
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'sparkle_posts/legacy', category: 'post', secure_url: imgUrl('legacy') });

        await residueJob.sweepOrphanPostRegistry();

        assert.equal(destroyCalls.length, 0);
        assert.equal(store.registry.length, 1);
    });

    it('sweepExpiredStoryMedia keeps story media that a live story still references', async () => {
        store.stories.push({ story_id: 's-1', media_url: vidUrl('alive'), thumbnail_url: null, audio_url: null });
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'sparkle_stories/alive', category: 'story', secure_url: vidUrl('alive') });

        await residueJob.sweepExpiredStoryMedia();

        assert.equal(destroyCalls.length, 0);
        assert.equal(store.registry.length, 1);
    });

    it('sweepExpiredStoryMedia reclaims story media whose story row was purged', async () => {
        // Purged story: no story row remains, the registry row is left behind.
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'sparkle_stories/purged', category: 'story', secure_url: vidUrl('purged') });

        await residueJob.sweepExpiredStoryMedia();

        assert.equal(destroyCalls.length, 1);
        assert.equal(destroyCalls[0].publicId, 'sparkle_stories/purged');
        assert.equal(store.registry.length, 0);
    });

    it('drops synthetic url_import_ registry rows without calling destroy', async () => {
        store.registry.push({ media_id: 'm-1', cloudinary_public_id: 'url_import_story-9', category: 'story', secure_url: null });

        await residueJob.sweepExpiredStoryMedia();

        assert.equal(destroyCalls.length, 0);
        assert.equal(store.registry.length, 0);
    });

    it('every sweep is error-guarded: a failing query never rejects', async () => {
        const boom = installFakePool(() => { throw new Error('db down'); });
        try {
            for (const sweep of [
                residueJob.sweepOrphanSavedPosts,
                residueJob.sweepOrphanNotifications,
                residueJob.sweepOrphanPostRegistry,
                residueJob.sweepExpiredStoryMedia
            ]) {
                await assert.doesNotReject(sweep());
            }
        } finally {
            boom.restore();
        }
    });

    it('a sweep keeps going when destroying one asset fails (retried next run)', async () => {
        destroyImpl = async (publicId) => {
            if (publicId === 'sparkle_posts/bad') throw new Error('destroy failed');
            return { result: 'ok' };
        };
        store.registry.push(
            { media_id: 'm-1', cloudinary_public_id: 'sparkle_posts/bad', category: 'post', secure_url: imgUrl('bad') },
            { media_id: 'm-2', cloudinary_public_id: 'sparkle_posts/good', category: 'post', secure_url: imgUrl('good') }
        );

        await residueJob.sweepOrphanPostRegistry();

        assert.equal(destroyCalls.length, 2);
        // The good asset is reclaimed; the failed one stays for the next run.
        assert.deepEqual(store.registry.map((r) => r.media_id), ['m-1']);
    });
});

describe('residue job wiring + contracts', () => {
    it('exports an init hook and all four sweeps', () => {
        assert.equal(typeof residueJob.initResidueCleanupJobs, 'function');
        for (const sweep of [
            'sweepOrphanSavedPosts',
            'sweepOrphanNotifications',
            'sweepOrphanPostRegistry',
            'sweepExpiredStoryMedia'
        ]) {
            assert.equal(typeof residueJob[sweep], 'function', `missing export ${sweep}`);
        }
    });

    it('schedules hourly on node-cron and runs every sweep (source contract)', () => {
        const src = read('backend/jobs/residue-cleanup.job.js');
        assert.ok(src.includes("require('node-cron')"), 'node-cron dependency');
        assert.ok(src.includes("cron.schedule('0 * * * *'"), 'hourly schedule');
        const catches = src.match(/catch\s*\(/g) || [];
        assert.ok(catches.length >= 4, `every sweep is error-guarded (found ${catches.length} catch blocks)`);
        for (const sweep of [
            'sweepOrphanSavedPosts',
            'sweepOrphanNotifications',
            'sweepOrphanPostRegistry',
            'sweepExpiredStoryMedia'
        ]) {
            assert.ok(src.includes(`await ${sweep}()`), `sweep wired into the cron callback: ${sweep}`);
        }
    });

    it('server.js initialises the residue sweeps alongside the media jobs', () => {
        const src = read('backend/server.js');
        assert.ok(src.includes("require('./jobs/residue-cleanup.job')"), 'job module wired');
        assert.ok(src.includes('initResidueCleanupJobs();'), 'init hook called at startup');
    });

    it('media.service.js exports the shared delete primitive', () => {
        const src = read('backend/services/media.service.js');
        for (const fn of ['extractCloudinaryRef', 'isMediaUrlReferenced', 'deleteMediaForUrls']) {
            assert.ok(src.includes(`static ${fn}(`) || src.includes(`static async ${fn}(`), `MediaService.${fn} defined`);
            assert.equal(typeof MediaService[fn], 'function', `MediaService.${fn} exported`);
        }
    });

    it('new code never depends on the absent cleanup_priority column', () => {
        const src = read('backend/jobs/residue-cleanup.job.js');
        assert.ok(!src.includes('cleanup_priority'), 'pre-existing broken column left alone');
    });
});
