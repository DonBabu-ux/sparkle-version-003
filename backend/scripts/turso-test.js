require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const URL = process.env.TURSO_DATABASE_URL;
const TOKEN = process.env.TURSO_AUTH_TOKEN;

(async () => {
  if (!TOKEN) {
    console.error('TURSO_AUTH_TOKEN is empty.');
    console.error('Get one: Turso dashboard -> lilbee-lilelogics -> Create Token');
    console.error('then paste it into backend/.env and rerun: node scripts/turso-test.js');
    process.exit(2);
  }

  const db = createClient({ url: URL, authToken: TOKEN });
  const ms = (t0) => Date.now() - t0;

  let t0 = Date.now();
  const ping = await db.execute('SELECT 1 AS ok');
  console.log('[1/5] connect      ok  ({}ms)  result={}', ms(t0), JSON.stringify(ping.rows));

  t0 = Date.now();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema', 'messages.sql'), 'utf8');
  await db.executeMultiple(schema);
  console.log('[2/5] schema       ok  ({}ms)', ms(t0));

  t0 = Date.now();
  const ins = await db.execute({
    sql: 'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
    args: [1, 1, 'sparkle-turso-connection-test'],
  });
  const newId = Number(ins.lastInsertRowid);
  console.log('[3/5] write        ok  ({}ms)  message_id={}', ms(t0), newId);

  t0 = Date.now();
  const sel = await db.execute({
    sql: 'SELECT * FROM messages WHERE conversation_id = ? AND message_id > ? ORDER BY message_id LIMIT 10',
    args: [1, 0],
  });
  console.log('[4/5] read         ok  ({}ms)  rows={}', ms(t0), sel.rows.length);
  console.log('           sample: {}', JSON.stringify(sel.rows[0] || null));

  t0 = Date.now();
  await db.execute({ sql: 'DELETE FROM messages WHERE body = ?', args: ['sparkle-turso-connection-test'] });
  console.log('[5/5] cleanup      ok  ({}ms)', ms(t0));

  console.log('\nALL GREEN - Turso is live for messages.');
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
