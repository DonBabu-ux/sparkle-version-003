const pool = require('./config/database');
require('dotenv').config();

async function inspect() {
    try {
        console.log('--- comments table ---');
        const [comments] = await pool.query('DESCRIBE comments');
        console.table(comments);

        console.log('--- comment_likes table ---');
        const [likes] = await pool.query('DESCRIBE comment_likes');
        console.table(likes);

        const [results] = await pool.query('SELECT * FROM comments LIMIT 1');
        console.log('--- sample comment ---');
        console.log(results[0]);

        await pool.end();
    } catch (err) {
        console.error('Inspection failed:', err);
    }
}

inspect();
