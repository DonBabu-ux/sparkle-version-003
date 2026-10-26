require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const DROP = `
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS sync_state;
DROP TABLE IF EXISTS share_recipients;
`;

(async () => {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  await db.executeMultiple(DROP);
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema', 'messages.sql'), 'utf8');
  await db.executeMultiple(schema);
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('migrated. tables:', tables.rows.map((r) => r.name).join(', '));
  const cols = await db.execute('PRAGMA table_info(messages)');
  console.log('messages cols:', cols.rows.map((c) => c.name).join(', '));
})().catch((e) => {
  console.error('MIGRATION FAILED:', e.message);
  process.exit(1);
});
