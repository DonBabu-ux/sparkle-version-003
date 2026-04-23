const mysql = require('mysql2/promise');

async function test() {
    const configs = [
        {
            name: 'Original Password (@lilbeeLogics)',
            host: 'mysql-lilbee.alwaysdata.net',
            user: 'lilbee',
            password: '@lilbeeLogics',
            database: 'lilbee_sparkle'
        },
        {
            name: 'Alternative Password (OmOfk93ORsLmT5Du)',
            host: 'mysql-lilbee.alwaysdata.net',
            user: 'lilbee',
            password: 'OmOfk93ORsLmT5Du',
            database: 'lilbee_sparkle'
        }
    ];

    for (const config of configs) {
        console.log(`Testing: ${config.name}...`);
        try {
            const connection = await mysql.createConnection({
                host: config.host,
                user: config.user,
                password: config.password,
                database: config.database,
                connectTimeout: 5000
            });
            console.log(`✅ Success for ${config.name}!`);
            await connection.end();
        } catch (err) {
            console.error(`❌ Failed for ${config.name}: ${err.message}`);
        }
    }
}

test();
