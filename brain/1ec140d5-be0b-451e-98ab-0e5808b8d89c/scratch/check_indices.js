const mysql = require('mysql2/promise');
const fs = require('fs');

async function check() {
    const connection = await mysql.createConnection({
        host: 'mysql-lilbee.alwaysdata.net',
        user: 'lilbee',
        password: '@lilbeeLogics',
        database: 'lilbee_sparkle'
    });

    try {
        const [rows] = await connection.query('SHOW INDEX FROM moments');
        fs.writeFileSync('c:\\Users\\user\\Desktop\\BABU DON\\SPARKLE\\SPARKLE 2\\sparkle-version-003\\brain\\1ec140d5-be0b-451e-98ab-0e5808b8d89c\\scratch\\moments_indices.json', JSON.stringify(rows, null, 2));
        console.log('Moments indices written to file');
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

check();
