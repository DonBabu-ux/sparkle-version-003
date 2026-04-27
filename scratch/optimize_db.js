const pool = require('../config/database');
async function optimize() {
  try {
    console.log('Adding performance indexes...');
    
    // Index for recency filtering
    await pool.query('CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at)');
    
    // Index for campus/privacy filtering
    await pool.query('CREATE INDEX IF NOT EXISTS idx_posts_campus_type ON posts(campus, post_type)');
    
    // Index for category matching
    await pool.query('CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category)');
    
    // Index for user actions (affinity calculation)
    await pool.query('CREATE INDEX IF NOT EXISTS idx_actions_user_type ON user_actions(user_id, action_type)');
    
    console.log('Successfully optimized database indexes! 🚀');
  } catch (e) {
    // MySQL 5.7 doesn't support IF NOT EXISTS for CREATE INDEX, so we ignore "duplicate index" errors
    if (e.code === 'ER_DUP_KEYNAME') {
       console.log('Indexes already exist.');
    } else {
       console.error('Index optimization error:', e.message);
    }
  } finally {
    process.exit();
  }
}
optimize();
