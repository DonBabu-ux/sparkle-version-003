require('dotenv').config();
const pool = require('../config/database');

const WATCH_INTERVAL = 10000; // 10 seconds
const isWatchMode = process.argv.includes('--watch');

async function findUsers() {
    let lastUserCount = 0;
    let isFirstRun = true;

    async function runCheck() {
        try {
            if (isFirstRun) {
                console.log('\n--- Sparkle User Monitor Started ---');
                console.log(`Checking table in database: ${process.env.DB_NAME}`);
            }

            // Get total user count
            const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');
            const totalUsers = countResult[0].total;

            if (isFirstRun || totalUsers > lastUserCount) {
                if (!isFirstRun) {
                    console.log(`\n🔔 NEW SIGNUP! Total users increased: ${lastUserCount} -> ${totalUsers}`);
                } else {
                    console.log(`\nFound total: ${totalUsers} users.`);
                }

                // Get the latest users (if count changed or first run)
                const limit = isFirstRun ? 5 : (totalUsers - lastUserCount);
                const [latestUsers] = await pool.query(`SELECT user_id, name, username, email, joined_at FROM users ORDER BY joined_at DESC LIMIT ${limit}`);

                if (latestUsers.length > 0) {
                    console.log(`\n--- ${isFirstRun ? 'Latest' : 'New'} Users ---`);
                    console.table(latestUsers);
                }
                
                lastUserCount = totalUsers;
            } else if (!isWatchMode) {
                console.log('\n No new users since last check.');
            }

            isFirstRun = false;

            if (!isWatchMode) {
                console.log('\n--- Report Complete ---');
                await pool.end();
                process.exit(0);
            } else {
                process.stdout.write('.'); // Just a heartbeat
            }
        } catch (err) {
            console.error('\n Error querying database:');
            console.error(err.message);
            if (isWatchMode) {
                console.log(`Retrying in ${WATCH_INTERVAL / 1000}s...`);
            } else {
                await pool.end();
                process.exit(1);
            }
        }
    }

    if (isWatchMode) {
        console.log(`\n Watching for new users every ${WATCH_INTERVAL / 1000}s... (Press Ctrl+C to stop)`);
        setInterval(runCheck, WATCH_INTERVAL);
    }
    
    // Initial run
    await runCheck();
}

findUsers();
