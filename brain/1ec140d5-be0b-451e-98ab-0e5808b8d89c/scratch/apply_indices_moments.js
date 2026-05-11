const mysql = require('mysql2/promise');

async function apply() {
    const connection = await mysql.createConnection({
        host: 'mysql-lilbee.alwaysdata.net',
        user: 'lilbee',
        password: '@lilbeeLogics',
        database: 'lilbee_sparkle'
    });

    try {
        console.log('Adding index to moments...');
        await connection.query('CREATE INDEX idx_moments_created_at ON moments(created_at)');
        console.log('✅ moments index added');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await connection.end();
    }
}

apply();
