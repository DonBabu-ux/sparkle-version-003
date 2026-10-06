require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Stories v5 Features Migration...');
        
        // 1. Add story_layers column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN story_layers JSON DEFAULT NULL`);
            console.log('✅ Added story_layers column');
        } catch (e) {
            console.log('ℹ️ story_layers might already exist');
        }

        // 2. Add story_duration column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN story_duration INT DEFAULT 10`);
            console.log('✅ Added story_duration column');
        } catch (e) {
            console.log('ℹ️ story_duration might already exist');
        }

        // 3. Add story_version column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN story_version INT DEFAULT 1`);
            console.log('✅ Added story_version column');
        } catch (e) {
            console.log('ℹ️ story_version might already exist');
        }

        // 4. Add story_theme column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN story_theme VARCHAR(100) DEFAULT NULL`);
            console.log('✅ Added story_theme column');
        } catch (e) {
            console.log('ℹ️ story_theme might already exist');
        }

        // 5. Add story_effects column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN story_effects JSON DEFAULT NULL`);
            console.log('✅ Added story_effects column');
        } catch (e) {
            console.log('ℹ️ story_effects might already exist');
        }

        // 6. Migrate existing stories to the new story_layers layout
        console.log('🔄 Migrating legacy stories to new layers layout...');
        const [stories] = await pool.query(`
            SELECT story_id, stickers, audio_url, audio_source, audio_start, audio_duration, music_info, type, collage_data, duration 
            FROM stories
        `);

        console.log(`Found ${stories.length} stories to check.`);
        
        for (const s of stories) {
            const layers = [];
            
            // Migrate legacy stickers
            if (s.stickers) {
                try {
                    const parsedStickers = typeof s.stickers === 'string' ? JSON.parse(s.stickers) : s.stickers;
                    if (Array.isArray(parsedStickers)) {
                        parsedStickers.forEach((st, idx) => {
                            layers.push({
                                id: st.id || st.sticker_id || `legacy-st-${idx}-${Date.now()}`,
                                type: st.type || 'emoji',
                                x: st.x || st.position_x || 50,
                                y: st.y || st.position_y || 50,
                                scale: st.scale || 1,
                                rotation: st.rotation || 0,
                                opacity: 1,
                                zIndex: idx + 1,
                                locked: false,
                                hidden: false,
                                data: st.config || {}
                            });
                        });
                    }
                } catch (err) {
                    console.warn(`[Migration] Failed to parse stickers for story ${s.story_id}:`, err.message);
                }
            }

            // Migrate legacy music/audio info into a music layer
            if (s.audio_url) {
                let musicInfo = null;
                if (s.music_info) {
                    try {
                        musicInfo = typeof s.music_info === 'string' ? JSON.parse(s.music_info) : s.music_info;
                    } catch (err) {
                        // ignore
                        console.warn('migrate-stories-v5: music_info parse skipped:', err.message);
                    }
                }
                
                layers.push({
                    id: `legacy-music-${Date.now()}`,
                    type: 'music',
                    x: 50,
                    y: 75,
                    scale: 1,
                    rotation: 0,
                    opacity: 1,
                    zIndex: 20,
                    locked: false,
                    hidden: false,
                    data: {
                        trackId: musicInfo?.trackId || musicInfo?.id || 'legacy',
                        title: musicInfo?.title || 'Summer Vibes',
                        artist: musicInfo?.artist || 'Unknown Artist',
                        url: s.audio_url,
                        start: s.audio_start || 0,
                        duration: s.audio_duration || 15,
                        style: musicInfo?.style || 1,
                        thumbnailUrl: musicInfo?.thumbnailUrl || null
                    }
                });
            }

            // Determine story_duration
            let storyDur = 10;
            if (s.duration) {
                const durVal = parseFloat(s.duration);
                if (durVal <= 5) storyDur = 5;
                else if (durVal <= 10) storyDur = 10;
                else if (durVal <= 15) storyDur = 15;
                else storyDur = 30;
            }

            // Save migrated fields
            await pool.query(
                `UPDATE stories SET story_layers = ?, story_duration = ? WHERE story_id = ?`,
                [JSON.stringify(layers), storyDur, s.story_id]
            );
        }

        console.log('✅ Migration v5 completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
