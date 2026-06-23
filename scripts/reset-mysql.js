// scripts/reset-mysql.js
// Run this script to kill all MySQL connections for user 'lilbee'

const mysql = require('mysql2/promise');

async function resetConnections() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: process.env.MYSQL_ROOT_PASSWORD || '', // set env or replace manually
        database: 'mysql'
    });

    console.log('🔍 Finding connections for user: lilbee...');
    const [rows] = await connection.query(`
        SELECT CONCAT('KILL ', id, ';') AS kill_stmt
        FROM information_schema.processlist 
        WHERE user = 'lilbee'
    `);

    if (rows.length === 0) {
        console.log('✅ No connections found for lilbee');
        await connection.end();
        return;
    }

    console.log(`📊 Found ${rows.length} connections to kill`);
    for (const row of rows) {
        try {
            await connection.query(row.kill_stmt);
            console.log('✅ Killed connection');
        } catch (e) {
            console.log('❌ Failed to kill:', e.message);
        }
    }

    await connection.end();
    console.log('✅ All connections killed');
}

resetConnections().catch(err => {
    console.error('Error during reset:', err);
});
