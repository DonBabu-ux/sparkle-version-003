const pool = require('./config/database');
async function test() {
    try {
        const [rows] = await pool.query('SHOW TABLES');
        console.log('✅ Tables:', rows);
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}
test();
