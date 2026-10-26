/* E2E test for the Turso mirror + pull path.
 * Writes go through the mirror service (same as Message.sendMessage),
 * reads through the HTTP pull route. Run: node tests/turso-messages.test.js
 */
require('dotenv').config();

const path = require('path');
const Module = require('module');

const BACKEND = path.join(__dirname, '..');

const stub = (resolvedPath, exports) => {
  const m = new Module(resolvedPath);
  m.filename = resolvedPath;
  m.loaded = true;
  m.exports = exports;
  require.cache[resolvedPath] = m;
};

stub(path.join(BACKEND, 'socket', 'index.js'), { getIO: () => ({}) });
stub(path.join(BACKEND, 'middleware', 'auth.middleware.js'), {
  authMiddleware: (req, _res, next) => {
    req.user = { userId: 'user-uuid-test', user_id: 'user-uuid-test' };
    next();
  },
});

const express = require('express');
const mirror = require(path.join(BACKEND, 'services', 'tursoMirror'));
const { getTurso } = require(path.join(BACKEND, 'config', 'turso'));

const app = express();
app.use(express.json());
app.use('/turso-messages', require(path.join(BACKEND, 'routes', 'api', 'turso-messages.routes')));

const PORT = 4599;
const BASE = `http://127.0.0.1:${PORT}/turso-messages`;
const CHAT = 'e2e-chat-uuid-001';

(async () => {
  const server = app.listen(PORT, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));

  let pass = 0;
  let fail = 0;
  const check = (name, ok, detail = '') => {
    if (ok) { pass += 1; console.log(`PASS ${name}`); }
    else { fail += 1; console.log(`FAIL ${name} ${detail}`); }
  };

  const written = [];
  try {
    check('dual-write enabled by default', mirror.enabled() === true);

    for (let i = 1; i <= 3; i++) {
      const id = `msg-uuid-${Date.now()}-${i}`;
      written.push(id);
      const r = await mirror.mirrorMessage({
        messageId: id,
        chatId: CHAT,
        senderId: 'user-uuid-test',
        content: `mirror message ${i}`,
        mediaUrl: null,
      });
      check(`mirror write ${i} (id preserved)`, r.mirrored === true && r.seq > 0, JSON.stringify(r));
    }

    const dup = await mirror.mirrorMessage({
      messageId: written[0], chatId: CHAT, senderId: 'user-uuid-test', content: 'again',
    });
    check('idempotent re-mirror', dup.mirrored === true, JSON.stringify(dup));

    const pullRes = await fetch(`${BASE}/conversations/${CHAT}/messages?after=0&limit=10`);
    const pull = await pullRes.json();
    const ours = pull.messages.filter((m) => written.includes(m.message_id));
    check('pull returns all 3 unique', ours.length === 3, JSON.stringify(ours.map((m) => m.body)));
    check('pull ordered by seq', ours.every((m, i) => i === 0 || m.seq > ours[i - 1].seq));
    check('pull watermark = last seq', pull.watermark === ours[ours.length - 1].seq, JSON.stringify(pull.watermark));

    const after = await fetch(`${BASE}/conversations/${CHAT}/messages?after=${pull.watermark}`);
    const afterJson = await after.json();
    check('after-watermark pull empty', afterJson.messages.length === 0);

    const health = await (await fetch(`${BASE}/health`)).json();
    check('health ok', health.status === 'ok', JSON.stringify(health));
  } catch (err) {
    fail += 1;
    console.log('FAIL harness threw:', err.message);
  } finally {
    for (const id of written) {
      await getTurso().execute({ sql: 'DELETE FROM messages WHERE message_id = ?', args: [id] }).catch(() => {});
    }
    server.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
