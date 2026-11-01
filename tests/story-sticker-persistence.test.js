// tests/story-sticker-persistence.test.js
// Story stickers used to exist only as story_layers JSON, so the interaction
// endpoints (poll votes / add-yours responses / reactions) hit FK targets that
// no row ever populated and 500'd server-side. This suite pins the contract:
//   - createStory inserts story_stickers rows (one per poll / add_yours /
//     reaction / quiz layer) keyed on the layer's OWN id, plus the matching
//     add_yours_prompts row so responses can FK to it.
//   - that persistence is best-effort: an INSERT failure must never fail the
//     publish (story_layers stays the display source of truth).
//   - the respond handler persists the viewer's content in
//     add_yours_responses.content (and the read path returns it).
// Fake pool.query router — no real database required.
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-route-only';

const pool = require('../backend/config/database');
const feed = require('../backend/controllers/feed.controller');
const stickers = require('../backend/controllers/sticker.controller');

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
}

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

const stickerRowsOf = (call) => (call && Array.isArray(call.params[0]) ? call.params[0] : []);

describe('createStory — interactive sticker persistence', () => {
    let prevFindDuplicate;
    let prevRegisterMedia;
    let prevRedisGet;
    let prevRedisDel;

    before(() => {
        const MediaService = require('../backend/services/media.service');
        prevFindDuplicate = MediaService.findDuplicate;
        prevRegisterMedia = MediaService.registerMedia;
        MediaService.findDuplicate = async () => null;
        MediaService.registerMedia = async () => null;
        const redisService = require('../backend/services/redis.service');
        prevRedisGet = redisService.get;
        prevRedisDel = redisService.del;
        redisService.get = async () => null;
        redisService.del = async () => null;
        global.__redisStubbed = true;
    });

    after(() => {
        const MediaService = require('../backend/services/media.service');
        MediaService.findDuplicate = prevFindDuplicate;
        MediaService.registerMedia = prevRegisterMedia;
        const redisService = require('../backend/services/redis.service');
        redisService.get = prevRedisGet;
        redisService.del = prevRedisDel;
    });

    async function createStoryWith(layers, { failStickerInsert = false } = {}) {
        const req = {
            body: { media_url: 'https://cdn/x.jpg', story_layers: layers },
            user: { userId: 'author-1' },
            app: { get: () => undefined },
        };
        const res = mockRes();
        const fake = installFakePool((text) => {
            if (text.startsWith('INSERT INTO stories')) return [{ insertId: 1 }];
            if (text.startsWith('INSERT INTO story_stickers')) {
                if (failStickerInsert) {
                    const err = new Error('FK constraint fails');
                    err.code = 'ER_NO_REFERENCED_ROW_2';
                    throw err;
                }
                return [[]];
            }
            if (text.startsWith('INSERT INTO add_yours_prompts')) return [[]];
            return [[]];
        });
        const persistedLayers = () => {
            const storyInsert = fake.calls.find(c => c.sql.startsWith('INSERT INTO stories'));
            if (!storyInsert) return null;
            const raw = storyInsert.params.find(p => typeof p === 'string' && p.startsWith('[{"id"'));
            return raw ? JSON.parse(raw) : null;
        };
        try {
            await feed.createStory(req, res);
        } finally {
            const stickerInsert = fake.calls.find(c => c.sql.startsWith('INSERT INTO story_stickers'));
            const promptInsert = fake.calls.find(c => c.sql.startsWith('INSERT INTO add_yours_prompts'));
            const layersOut = persistedLayers();
            fake.restore();
            return { res, stickerInsert, promptInsert, layersOut, failed: res.statusCode >= 400 };
        }
    }

    it('inserts story_stickers rows for poll and add_yours layers using the layer id as sticker_id', async () => {
        const layers = [
            { id: 'st-1700000000001', type: 'poll', x: 40, y: 55, scale: 1.2, rotation: 0, data: { question: 'Cats?', options: ['yes', 'no'], votes: [0, 0] } },
            { id: 'st-1700000000002', type: 'add_yours', x: 50, y: 35, scale: 1, rotation: 0, data: { prompt: 'Show me your view' } },
            { id: 'st-1700000000003', type: 'text', x: 10, y: 10, scale: 1, rotation: 0, data: { text: 'hi' } },
        ];

        const { stickerInsert, failed } = await createStoryWith(layers);
        assert.equal(failed, false);

        assert.ok(stickerInsert, 'story_stickers INSERT executed');
        assert.match(stickerInsert.sql, /INSERT INTO story_stickers/);
        assert.match(stickerInsert.sql, /\(sticker_id, story_id, type, config, position_x, position_y, scale, rotation\)/);

        const rows = stickerRowsOf(stickerInsert);
        assert.equal(rows.length, 2, 'one row per interactive layer (text layers are not persisted)');

        const byId = new Map(rows.map(r => [r[0], r]));
        for (const id of ['st-1700000000001', 'st-1700000000002']) {
            assert.ok(byId.has(id), `sticker_id kept as the layer's own id: ${id}`);
        }

        const poll = byId.get('st-1700000000001');
        assert.equal(poll[2], 'poll');
        assert.equal(poll[4], 40);
        assert.equal(poll[5], 55);
        assert.equal(poll[6], 1.2);
        assert.equal(JSON.parse(poll[3]).question, 'Cats?');

        const prompt = byId.get('st-1700000000002');
        assert.equal(prompt[2], 'add_yours');
        assert.equal(JSON.parse(prompt[3]).prompt, 'Show me your view');
    });

    it('keeps the persisted sticker_id identical to the id stored in story_layers', async () => {
        const layers = [
            { id: 'st-1700000000010', type: 'poll', x: 30, y: 40, scale: 1, rotation: 0, data: { question: 'Q' } },
            { id: 'st-1700000000011', type: 'reaction', x: 50, y: 50, scale: 1, rotation: 0, data: { emoji: '❤️' } },
        ];

        const { stickerInsert, layersOut } = await createStoryWith(layers);
        const rows = stickerRowsOf(stickerInsert);
        assert.equal(rows.length, 2);

        const storedIds = layersOut.filter(l => l.type === 'poll' || l.type === 'reaction').map(l => l.id).sort();
        assert.deepEqual(rows.map(r => r[0]).sort(), storedIds);
    });

    it('persists quiz layers even though no quiz endpoint exists yet', async () => {
        const layers = [
            { id: 'st-1700000000020', type: 'quiz', x: 50, y: 50, scale: 1, rotation: 0, data: { question: 'Capital?', options: ['a', 'b'], correct: 0 } },
        ];

        const { stickerInsert } = await createStoryWith(layers);
        const rows = stickerRowsOf(stickerInsert);
        assert.equal(rows.length, 1);
        assert.equal(rows[0][0], 'st-1700000000020');
        assert.equal(rows[0][2], 'quiz');
    });

    it('creates the matching add_yours_prompts row so responses can FK to it', async () => {
        const layers = [
            { id: 'st-1700000000030', type: 'add_yours', x: 50, y: 35, scale: 1, rotation: 0, data: { prompt: 'Add yours' } },
            { id: 'st-1700000000031', type: 'poll', x: 50, y: 50, scale: 1, rotation: 0, data: { question: 'Q' } },
        ];

        const { promptInsert } = await createStoryWith(layers);
        assert.ok(promptInsert, 'add_yours_prompts INSERT executed');
        const rows = stickerRowsOf(promptInsert);
        assert.equal(rows.length, 1, 'only the add_yours layer gets a prompt row');
        assert.equal(rows[0][0], 'st-1700000000030');
        assert.equal(rows[0][1], 'author-1');
        assert.equal(rows[0][2], 'Add yours');
    });

    it('does not persist stickers when no interactive layer is present', async () => {
        const { stickerInsert, promptInsert, res } = await createStoryWith([
            { id: 'st-1700000000040', type: 'text', x: 50, y: 50, scale: 1, rotation: 0, data: { text: 'hello' } },
            { id: 'music-1700000000040', type: 'music', x: 50, y: 75, scale: 1, rotation: 0, data: { url: 'x' } },
        ]);
        assert.equal(stickerInsert, undefined);
        assert.equal(promptInsert, undefined);
        assert.equal(res.statusCode, 201);
    });

    it('still publishes the story when sticker persistence fails', async () => {
        const { res, stickerInsert } = await createStoryWith(
            [{ id: 'st-1700000000050', type: 'poll', x: 50, y: 50, scale: 1, rotation: 0, data: { question: 'Q' } }],
            { failStickerInsert: true }
        );
        assert.equal(res.statusCode, 201, 'story creation is unaffected');
        assert.equal(res.body.status, 'success');
        assert.ok(res.body.story_id);
        assert.ok(stickerInsert, 'the sticker insert was attempted');
    });
});

describe('sticker controller — response content', () => {
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    it('persists the content the client sent on a response', async () => {
        fake = installFakePool(() => [[]]);
        const res = mockRes();
        await stickers.respondToAddYours({
            body: { prompt_id: 'st-1700000000060', story_id: 'story-1', content: 'Here is my take' },
            user: { userId: 'viewer-1' },
        }, res);

        assert.equal(res.statusCode, 201);
        const insert = fake.calls.find(c => c.sql.includes('INSERT INTO add_yours_responses'));
        assert.ok(insert, 'add_yours_responses INSERT executed');
        assert.match(insert.sql, /content/);
        assert.equal(insert.params.length, 5);
        assert.equal(insert.params[1], 'st-1700000000060');
        assert.equal(insert.params[2], 'viewer-1');
        assert.equal(insert.params[3], 'story-1');
        assert.equal(insert.params[4], 'Here is my take');
    });

    it('nulls content instead of failing when the field is absent', async () => {
        fake = installFakePool(() => [[]]);
        const res = mockRes();
        await stickers.respondToAddYours({
            body: { prompt_id: 'st-1', story_id: 'story-1' },
            user: { userId: 'viewer-1' },
        }, res);

        assert.equal(res.statusCode, 201);
        const insert = fake.calls.find(c => c.sql.includes('INSERT INTO add_yours_responses'));
        assert.equal(insert.params.length, 5);
        assert.equal(insert.params[4], null);
    });

    it('returns the stored content on the read path', async () => {
        fake = installFakePool((text) => {
            if (text.includes('FROM add_yours_prompts')) return [[{ prompt_id: 'st-1', text: 'Add yours' }]];
            if (text.includes('FROM add_yours_responses')) {
                return [[{ response_id: 'r1', user_id: 'viewer-2', username: 'viewer', content: 'my reply' }]];
            }
            return [[]];
        });
        const res = mockRes();
        await stickers.getAddYoursData({ params: { prompt_id: 'st-1' }, user: { userId: 'viewer-1' } }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.responses.length, 1);
        assert.equal(res.body.responses[0].content, 'my reply');
    });

    it('normalises legacy rows (no content) to null', async () => {
        fake = installFakePool((text) => {
            if (text.includes('FROM add_yours_prompts')) return [[{ prompt_id: 'st-1', text: 'Add yours' }]];
            if (text.includes('FROM add_yours_responses')) return [[{ response_id: 'r1', user_id: 'viewer-2' }]];
            return [[]];
        });
        const res = mockRes();
        await stickers.getAddYoursData({ params: { prompt_id: 'st-1' }, user: { userId: 'viewer-1' } }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.responses[0].content, null);
    });
});

describe('sticker controller — reaction path', () => {
    let fake;
    afterEach(() => { fake?.restore(); fake = null; });

    it('writes story_reactions with the story and emoji', async () => {
        fake = installFakePool(() => [[]]);
        const res = mockRes();
        await stickers.reactToStory({
            body: { story_id: 'story-1', emoji: '❤️' },
            user: { userId: 'viewer-1' },
        }, res);

        assert.equal(res.statusCode, 200);
        const insert = fake.calls.find(c => c.sql.includes('INSERT INTO story_reactions'));
        assert.ok(insert, 'story_reactions INSERT executed');
        assert.equal(insert.params.length, 4);
        assert.equal(insert.params[1], 'story-1');
        assert.equal(insert.params[2], 'viewer-1');
        assert.equal(insert.params[3], '❤️');
    });

    it('writes sticker_poll_votes keyed on the sticker the client voted with', async () => {
        fake = installFakePool(() => [[]]);
        const res = mockRes();
        await stickers.votePoll({
            body: { sticker_id: 'st-1700000000070', option_index: 1 },
            user: { userId: 'viewer-1' },
        }, res);

        assert.equal(res.statusCode, 200);
        const insert = fake.calls.find(c => c.sql.includes('INSERT INTO sticker_poll_votes'));
        assert.ok(insert, 'sticker_poll_votes INSERT executed');
        assert.equal(insert.params[1], 'st-1700000000070');
        assert.equal(insert.params[3], 1);
    });
});
