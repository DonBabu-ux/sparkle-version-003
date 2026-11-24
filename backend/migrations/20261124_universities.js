/**
 * Migration Runner: 20261124_universities.js
 * Creates the universities reference table and seeds a proper full
 * list of global (African-first) universities so the profile/signup
 * campus picker is served from an API instead of hardcoded arrays.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function runMigration() {
    console.log('[Migration] Creating universities reference table...');

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS universities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                country VARCHAR(100) NOT NULL,
                state VARCHAR(100) NULL DEFAULT NULL,
                city VARCHAR(100) NULL DEFAULT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_universities_name (name(191)),
                INDEX idx_name (name(191)),
                INDEX idx_country (country),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('[Migration] universities table ensured.');

        // Seed data is idempotent via INSERT IGNORE on the unique name key.
        // Strip comment lines, then split on statement boundaries and run each
        // INSERT separately so one bad row doesn't abort the whole seed.
        const rawSql = require('fs').readFileSync(
            path.resolve(__dirname, '20261124_universities.sql'),
            'utf8'
        );
        const sqlNoComments = rawSql
            .split('\n')
            .filter(line => !line.trim().startsWith('--') && !line.trim().startsWith('/*') && !line.trim().startsWith('*'))
            .join('\n');
        const statements = sqlNoComments
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.toUpperCase().startsWith('CREATE'));

        let inserted = 0;
        for (const stmt of statements) {
            try {
                const [res] = await pool.query(stmt);
                inserted += (res && res.affectedRows) || 0;
            } catch (e) {
                // Duplicate name or empty statement — ignore (idempotent re-runs).
            }
        }
        console.log(`[Migration] universities seeded (attempted ${inserted} inserts).`);

        const [count] = await pool.query('SELECT COUNT(*) AS c FROM universities');
        console.log(`[Migration] universities table now has ${count[0].c} rows.`);
        console.log('[Migration] universities migration completed!');
        process.exit(0);
    } catch (err) {
        console.error('[Migration Error]:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    runMigration();
}

module.exports = runMigration;
