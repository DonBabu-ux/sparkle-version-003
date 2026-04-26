require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Stories Migration...');

        // 1. Update Stories Table
        await pool.query(`
            ALTER TABLE stories 
            ADD COLUMN IF NOT EXISTS parent_story_id CHAR(36) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS stickers JSON DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS audio_url VARCHAR(500) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS music_info JSON DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS background_color VARCHAR(20) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS type ENUM('media', 'text', 'collage') DEFAULT 'media',
            ADD COLUMN IF NOT EXISTS collage_data JSON DEFAULT NULL,
            ADD CONSTRAINT fk_story_parent FOREIGN KEY (parent_story_id) REFERENCES stories(story_id) ON DELETE SET NULL
        `).catch(err => console.warn('Note: parent_story_id might already exist or foreign key constraint failed.', err.message));

        // 2. Create Stickers Template Table (For Trending/Public stickers)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sticker_templates (
                template_id VARCHAR(36) PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                prompt TEXT,
                icon_name VARCHAR(100),
                usage_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Insert some default templates if empty
        const [templates] = await pool.query('SELECT COUNT(*) as count FROM sticker_templates');
        if (templates[0].count === 0) {
            await pool.query(`
                INSERT INTO sticker_templates (template_id, type, prompt, icon_name) VALUES
                (UUID(), 'add_yours', 'Show your pet 🐾', 'Camera'),
                (UUID(), 'add_yours', 'Current View 🌅', 'Camera'),
                (UUID(), 'add_yours', 'OOTD 👗', 'Camera'),
                (UUID(), 'poll', 'Pizza with Pineapple?', 'BarChart3'),
                (UUID(), 'reaction', 'Rate this!', 'Smile')
            `);
        }

        console.log('✅ Stories Migration Completed Successfully!');
    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
