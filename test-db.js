const pool = require('./config/database');
async function test() {
    try {
        const [rows] = await pool.query('SELECT 1');
        console.log('✅ Database Connection Successful');
        process.exit(0);
    } catch (err) {
        console.error('❌ Database Connection Failed:', err.message);
        process.exit(1);
    }
}
test();
