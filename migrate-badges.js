const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Badge & Reputation System Migration...');

        // 1. Badges Definition Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS badges (
                badge_id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                category ENUM('presence', 'reputation', 'creator', 'community', 'seasonal', 'trust') NOT NULL,
                rarity ENUM('common', 'rare', 'epic', 'legendary', 'elite') NOT NULL,
                description TEXT,
                icon_path VARCHAR(255),
                animation_type VARCHAR(50),
                unlock_logic JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. User Badges Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_badges (
                user_id CHAR(36),
                badge_id VARCHAR(50),
                level ENUM('bronze', 'silver', 'gold', 'legendary') DEFAULT 'bronze',
                progress INT DEFAULT 0,
                awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, badge_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (badge_id) REFERENCES badges(badge_id) ON DELETE CASCADE
            )
        `);

        // 3. User Reputation Table (Hidden Score)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_reputation (
                user_id CHAR(36) PRIMARY KEY,
                score INT DEFAULT 100,
                trust_level INT DEFAULT 1,
                engagement_quality FLOAT DEFAULT 1.0,
                toxicity_score FLOAT DEFAULT 0.0,
                report_count INT DEFAULT 0,
                support_score INT DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);

        // 4. Add profile view/view count tracking if not exists
        // (Already in users table as profile_views based on previous controllers)

        // 5. Seed initial badges
        const initialBadges = [
            ['spark_seed', 'Spark Seed', 'presence', 'common', 'Joined the Sparkle platform', 'spark_icon', 'pulse', '{}'],
            ['week_walker', 'Week Walker', 'presence', 'common', '7 consecutive active days', 'flame_ring', 'gentle_pulse', '{"days": 7}'],
            ['relatable_soul', 'Relatable Soul', 'reputation', 'rare', '1000 Relate reactions', 'heart_lines', 'shimmer', '{"relates": 1000}'],
            ['storyteller', 'Storyteller', 'creator', 'rare', 'Long-form engaging posts', 'feather_flame', 'float', '{"long_posts": 10}'],
            ['explorer', 'Explorer', 'community', 'common', 'Uses many platform systems', 'compass', 'rotate', '{"features_used": 5}'],
            ['midnight_confessor', 'Midnight Confessor', 'seasonal', 'epic', 'Posting vulnerable content after midnight', 'violet_flame', 'ethereal', '{"midnight_posts": 5}'],
            ['verified_badge', 'Verified', 'trust', 'elite', 'Premium platform trust and authenticity', 'sparkle_insignia', 'holographic', '{"trust_level": 5}']
        ];

        for (const badge of initialBadges) {
            await pool.query(`
                INSERT INTO badges (badge_id, name, category, rarity, description, icon_path, animation_type, unlock_logic)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE name = VALUES(name)
            `, badge);
        }

        console.log('✅ Badge & Reputation System migration successful!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
