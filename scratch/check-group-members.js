const pool = require('../config/database');
async function check() {
    try {
        const [cols] = await pool.query('DESCRIBE group_members');
        console.log(JSON.stringify(cols, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
