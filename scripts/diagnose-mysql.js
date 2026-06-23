// scripts/diagnose-mysql.js
// Diagnostic script - checks MySQL connection limits and current usage

const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnoseMySQL() {
    console.log('\n🔍 MySQL Connection Diagnostic');
    console.log('='.repeat(50));

    try {
        // 1. Test basic connection
        console.log('\n📡 Testing connection...');
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            port: parseInt(process.env.DB_PORT) || 3306,
            connectTimeout: 5000
        });

        console.log('✅ Connection successful');

        // 2. Check max_connections
        const [maxRows] = await conn.query('SHOW VARIABLES LIKE "max_connections"');
        const maxConnections = maxRows[0]?.Value || 'unknown';
        console.log(`\n📊 max_connections: ${maxConnections}`);

        // 3. Check max_user_connections
        const [userMaxRows] = await conn.query('SHOW VARIABLES LIKE "max_user_connections"');
        const maxUserConnections = userMaxRows[0]?.Value || 'unknown';
        console.log(`📊 max_user_connections: ${maxUserConnections}`);

        // 4. Get current connections
        const [currentRows] = await conn.query(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN command = 'Sleep' THEN 1 ELSE 0 END) as sleeping,
                   SUM(CASE WHEN command != 'Sleep' THEN 1 ELSE 0 END) as active
            FROM information_schema.processlist
        `);
        console.log(`\n📊 Current connections:`);
        console.log(`   Total: ${currentRows[0]?.total || 0}`);
        console.log(`   Sleeping: ${currentRows[0]?.sleeping || 0}`);
        console.log(`   Active: ${currentRows[0]?.active || 0}`);

        // 5. Get connections by user
        const [userRows] = await conn.query(`
            SELECT user, COUNT(*) as count,
                   SUM(CASE WHEN command = 'Sleep' THEN 1 ELSE 0 END) as sleeping,
                   SUM(CASE WHEN command != 'Sleep' THEN 1 ELSE 0 END) as active
            FROM information_schema.processlist
            GROUP BY user
            ORDER BY count DESC
        `);
        console.log('\n📊 Connections by user:');
        for (const row of userRows) {
            console.log(`   ${row.user}: ${row.count} (${row.sleeping} sleeping, ${row.active} active)`);
        }

        // 6. Check lilbee specifically
        const [lilbeeRows] = await conn.query(`
            SELECT id, user, host, db, command, time, state
            FROM information_schema.processlist
            WHERE user = 'lilbee'
            ORDER BY time DESC
        `);
        console.log(`\n📊 Connections for user 'lilbee': ${lilbeeRows.length}`);
        if (lilbeeRows.length > 0) {
            console.log('\n   Detailed list:');
            for (const row of lilbeeRows.slice(0, 20)) {
                console.log(`   ID: ${row.id}, Command: ${row.command}, Time: ${row.time}s, State: ${row.state || 'idle'}`);
            }
            if (lilbeeRows.length > 20) {
                console.log(`   ... and ${lilbeeRows.length - 20} more`);
            }
        }

        // 7. Check user grants
        const [grantRows] = await conn.query(`SHOW GRANTS FOR 'lilbee'@'%'`);
        console.log('\n📊 User grants for lilbee:');
        for (const row of grantRows) {
            console.log(`   ${row['Grants for lilbee@%'] || row[0]}`);
        }

        // 8. Recommendations
        console.log('\n💡 Recommendations:');
        if (lilbeeRows.length > 0 && parseInt(maxUserConnections) > 0) {
            const usage = Math.round((lilbeeRows.length / parseInt(maxUserConnections)) * 100);
            console.log(`   lilbee is using ${usage}% of max_user_connections (${lilbeeRows.length}/${maxUserConnections})`);
            if (usage > 80) {
                console.log('   ⚠️  High usage! Consider:');
                console.log('      - Killing idle connections: KILL <id>;');
                console.log('      - Increasing max_user_connections');
                console.log('      - Creating separate DB users for different services');
            }
        }

        console.log('\n🔧 Quick fixes:');
        console.log('   Kill all lilbee connections:');
        console.log(`   mysql -u root -p -e "SELECT CONCAT('KILL ', id, ';') FROM information_schema.processlist WHERE user='lilbee'" | mysql -u root -p`);
        console.log('\n   Increase user limit (if you have admin access):');
        console.log(`   ALTER USER 'lilbee'@'%' WITH MAX_USER_CONNECTIONS 100;`);

        await conn.end();
    } catch (error) {
        console.error('\n❌ Diagnostic failed:', error.message);
        if (error.code === 'ER_TOO_MANY_USER_CONNECTIONS') {
            console.log('\n⚠️  The database is rejecting connections because the user limit is exhausted.');
            console.log('   This is a DATABASE issue, not a Sparkle issue.');
            console.log('\n   To fix:');
            console.log('   1. Kill existing connections (as root)');
            console.log('   2. Increase max_user_connections');
            console.log('   3. Create a separate DB user for Sparkle');
        }
    }
}

diagnoseMySQL();
