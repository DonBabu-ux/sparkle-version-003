const pool = require('../config/database');
const cloudinary = require('cloudinary').v2;

exports.getStorageStats = async (req, res) => {
    try {
        // Only allow admins (in a real system we check req.user.role === 'admin')
        // For this implementation, we assume the route is protected or authorized.
        
        const [[totalStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total_assets,
                SUM(file_size_bytes) as total_bytes
            FROM media_registry
        `);

        const [categoryStats] = await pool.query(`
            SELECT category, COUNT(*) as count, SUM(file_size_bytes) as bytes 
            FROM media_registry 
            GROUP BY category
        `);

        const [lifecycleStats] = await pool.query(`
            SELECT lifecycle_state, COUNT(*) as count 
            FROM media_registry 
            GROUP BY lifecycle_state
        `);
        
        const [cleanupStats] = await pool.query(`
            SELECT cleanup_priority, COUNT(*) as count
            FROM media_registry
            GROUP BY cleanup_priority
        `);

        res.json({
            status: 'success',
            data: {
                total_assets: totalStats.total_assets || 0,
                total_bytes: totalStats.total_bytes || 0,
                categories: categoryStats,
                lifecycles: lifecycleStats,
                cleanup: cleanupStats
            }
        });
    } catch (error) {
        console.error('Failed to fetch storage stats:', error);
        res.status(500).json({ error: 'Failed to fetch storage stats' });
    }
};

exports.executeSafeCleanup = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT media_id, cloudinary_public_id 
            FROM media_registry 
            WHERE lifecycle_state = 'pending_cleanup' AND cleanup_priority = 'SAFE_TO_DELETE'
            LIMIT 100
        `);

        let deletedCount = 0;
        let errors = [];

        for (const row of rows) {
            try {
                if (!row.cloudinary_public_id.startsWith('url_import_')) {
                    await cloudinary.uploader.destroy(row.cloudinary_public_id);
                }
                await pool.query(`DELETE FROM media_registry WHERE media_id = ?`, [row.media_id]);
                deletedCount++;
            } catch (err) {
                errors.push({ id: row.media_id, error: err.message });
            }
        }

        res.json({
            status: 'success',
            message: `Cleaned up ${deletedCount} assets`,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to execute cleanup' });
    }
};
