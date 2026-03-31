require('dotenv').config();
const pool = require('./config/database');
const fs = require('fs');

async function checkGroupsSchema() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        const tables = ['groups', 'group_members', 'group_posts', 'join_requests'];
        for (const table of tables) {
            log(`--- Table: ${table} ---`);
            try {
                const [rows] = await pool.query(`DESCRIBE ${table}`);
                const columns = rows.map(r => `${r.Field} (${r.Type})`).join(', ');
                log(columns);
            } catch (err) {
                log(`Error describing table ${table}: ${err.message}`);
            }
        }

        log('\n--- Sample Groups ---');
        const [groups] = await pool.query('SELECT * FROM groups LIMIT 5');
        log(JSON.stringify(groups, null, 2));

        fs.writeFileSync('group_check_results.txt', output, 'utf8');

    } catch (err) {
        console.error('Fatal error during check:', err);
    } finally {
        process.exit();
    }
}

checkGroupsSchema();
