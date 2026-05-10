require('dotenv').config();
const pool = require('./config/database');

async function check() {
    try {
        const [reg] = await pool.query('SELECT media_id, secure_url FROM media_registry WHERE secure_url LIKE "%[object %"');
        console.log('Broken Registry:', reg);
        
        const [stories] = await pool.query('SELECT story_id, media_url FROM stories WHERE media_url LIKE "%[object %"');
        console.log('Broken Stories:', stories);

        const [posts] = await pool.query('SELECT post_id, media_url FROM posts WHERE media_url LIKE "%[object %"');
        console.log('Broken Posts:', posts);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
check();
