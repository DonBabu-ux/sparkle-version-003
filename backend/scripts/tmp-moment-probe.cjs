/* scratch diagnostic — read moment media fields */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
(async () => {
  const id = 'f8e106f2-1fc6-4a8d-bc4e-6edf54a637c6';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    connectTimeout: 60000,
  });
  const [rows] = await conn.execute('SELECT moment_id, user_id, media_url, media_type, created_at FROM moments WHERE moment_id = ?', [id]);
  console.log(JSON.stringify(rows, null, 2));
  if (rows[0] && rows[0].media_url) {
    const u = rows[0].media_url;
    // probe HEAD
    const https = u.startsWith('https') ? require('https') : require('http');
    await new Promise((res) => {
      const req = https.request(u, { method: 'HEAD' }, (r) => { console.log('PROBE', r.statusCode, r.headers['content-type'], r.headers['content-length']); res(); });
      req.on('error', (e) => { console.log('PROBE ERROR', e.message); res(); });
      req.end();
    });
  }
  await conn.end();
})().catch(e => { console.error('DB ERR', e.message); process.exit(1); });
