require('dotenv').config();
const pool = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'scripts', 'algorithm_migration.sql'), 'utf8');
        const commands = sql.split(';').filter(cmd => cmd.trim() !== '');

        console.log('Starting migration...');
        for (let cmd of commands) {
            console.log(`Executing: ${cmd.substring(0, 50)}...`);
            await pool.query(cmd);
        }
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
