const path = require('path');
const configPath = path.join(process.cwd(), 'config', 'database');
console.log('Loading config from:', configPath);
const pool = require(configPath);
async function describeUsers() {
    console.log('Querying DESCRIBE users...');
    try {
        const [rows] = await pool.query('DESCRIBE users');
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error('❌ Database Error:', err.message);
        console.error(err);
        process.exit(1);
    }
}
describeUsers();
