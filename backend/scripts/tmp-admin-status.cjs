/* scratch — report which admin accounts have the second credential set */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
(async () => {
    const c = await mysql.createConnection({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
        connectTimeout: 60000
    });
    const [rows] = await c.execute(
        "SELECT email, role, (admin_password_hash IS NOT NULL) AS admin_pw_set FROM users WHERE role IN ('admin','moderator') ORDER BY role DESC"
    );
    for (const r of rows) console.log(`${r.role.padEnd(9)} ${r.email.padEnd(40)} admin password set: ${r.admin_pw_set ? 'YES' : 'no (not set yet)'}`);
    await c.end();
    process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
