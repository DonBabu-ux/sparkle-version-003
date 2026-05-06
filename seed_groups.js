const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sparkle_db'
};

const mockGroups = [
    {
        name: 'Sparkle Creators',
        description: 'A place for designers, developers, and artists to share their work and collaborate on Sparkle projects.',
        category: 'Social',
        campus: 'Main Campus',
        is_public: 1,
        icon_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&q=80',
        cover_image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=1200&q=80'
    },
    {
        name: 'AI & Machine Learning Hub',
        description: 'Discussing the latest in AI, LLMs, and agentic workflows. Weekly study sessions and hackathons!',
        category: 'Study',
        campus: 'Tech Campus',
        is_public: 1,
        icon_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&q=80',
        cover_image: 'https://images.unsplash.com/photo-1620712943543-bcc4628c71d0?w=1200&q=80'
    },
    {
        name: 'Secret Garden',
        description: 'A private circle for deep discussions and personal growth. Requests are reviewed by moderators.',
        category: 'Social',
        campus: 'Main Campus',
        is_public: 0,
        icon_url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&q=80',
        cover_image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80'
    }
];

async function seed() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // Get some users to be owners/members
        const [users] = await connection.execute('SELECT user_id, campus FROM users LIMIT 10');
        if (users.length === 0) {
            console.error('No users found in database. Please register some users first.');
            return;
        }

        const ownerId = users[0].user_id;

        for (const g of mockGroups) {
            const groupId = uuidv4();

            console.log(`Seeding group: ${g.name}`);

            await connection.execute(
                `INSERT INTO \`groups\` (group_id, creator_id, name, description, campus, category, is_public, icon_url, cover_image) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [groupId, ownerId, g.name, g.description, g.campus, g.category, g.is_public, g.icon_url, g.cover_image]
            );

            // Add owner as admin (since 'owner' is not in DB enum, and Group.js uses it in JS but DB uses admin/moderator/member)
            // Note: Group.js addMember uses 'role' param, but DB only accepts 'admin', 'moderator', 'member'.
            await connection.execute(
                `INSERT INTO \`group_members\` (group_id, user_id, role, status) 
                 VALUES (?, ?, ?, ?)`,
                [groupId, ownerId, 'admin', 'active']
            );

            // Add some other members
            for (let i = 1; i < Math.min(users.length, 5); i++) {
                await connection.execute(
                    `INSERT INTO \`group_members\` (group_id, user_id, role, status) 
                     VALUES (?, ?, ?, ?)`,
                    [groupId, users[i].user_id, 'member', 'active']
                );
            }
            
            // Add a mock post
            // Check if group_posts table exists or use posts table
            const [postTables] = await connection.execute("SHOW TABLES LIKE 'group_posts'");
            if (postTables.length > 0) {
                await connection.execute(
                    `INSERT INTO \`group_posts\` (post_id, group_id, user_id, content) 
                     VALUES (?, ?, ?, ?)`,
                    [uuidv4(), groupId, ownerId, `Welcome to ${g.name}! Excited to start this journey together.`]
                );
            } else {
                await connection.execute(
                    `INSERT INTO \`posts\` (post_id, user_id, content, group_id, post_type, campus) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), ownerId, `Welcome to ${g.name}! Excited to start this journey together.`, groupId, 'public', g.campus]
                );
            }
        }

        console.log('Seeding completed successfully!');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        if (connection) await connection.end();
    }
}

seed();
