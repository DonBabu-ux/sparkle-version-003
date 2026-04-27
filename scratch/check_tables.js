const pool = require('../config/database');
async function check() {
  try {
    const [postsDesc] = await pool.query('DESCRIBE posts');
    console.log('Posts Schema:', postsDesc);
    const [actionsDesc] = await pool.query('DESCRIBE user_actions');
    console.log('Actions Schema:', actionsDesc);
    const [indexes] = await pool.query('SHOW INDEX FROM posts');
    console.log('Posts Indexes:', indexes);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
check();
