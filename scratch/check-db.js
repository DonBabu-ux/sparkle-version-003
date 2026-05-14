
const pool = require('./config/database');

async function checkDB() {
    try {
        console.log('Testing DB connection...');
        const [rows] = await pool.query('SELECT 1');
        console.log('✅ DB connection successful');
        
        const [status] = await pool.query("SHOW STATUS WHERE variable_name = 'Threads_connected'");
        console.log('Threads connected:', status[0].Value);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ DB check failed:');
        console.error(error);
        process.exit(1);
    }
}

checkDB();
