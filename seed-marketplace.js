require('dotenv').config();
const pool = require('./config/database');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    const connection = await pool.getConnection();
    try {
        console.log('🌱 Seeding Marketplace Data...');

        // 1. Get a seller ID
        const [users] = await connection.query('SELECT user_id FROM users LIMIT 1');
        if (users.length === 0) {
            console.error('❌ No users found to act as seller! Please sign up first.');
            return;
        }
        const sellerId = users[0].user_id;
        console.log(`Using seller ID: ${sellerId}`);

        // 2. Sample Listings
        const listings = [
            {
                id: uuidv4(),
                title: 'iPhone 13 Pro - Graphite',
                description: 'Like new iPhone 13 Pro 256GB. Battery health 92%. Comes with original box and cable.',
                price: 85000,
                category: 'electronics',
                condition: 'like_new',
                campus: 'main_campus',
                location: 'Student Center Mall',
                image: 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=800'
            },
            {
                id: uuidv4(),
                title: 'Engineering Mathematics Vol 2',
                description: 'Essential textbook for second year engineering. Decent condition, no torn pages.',
                price: 1500,
                category: 'books',
                condition: 'good',
                campus: 'north_campus',
                location: 'Math Department Library',
                image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800'
            },
            {
                id: uuidv4(),
                title: 'Dorm Desk Lamp (LED)',
                description: 'Adjustable brightness, 3 color modes. Perfect for late night study sessions.',
                price: 2500,
                category: 'home',
                condition: 'new',
                campus: 'main_campus',
                location: 'Dorm A Entrance',
                image: 'https://images.unsplash.com/photo-1534073828943-f801091bb18c?w=800'
            },
            {
                id: uuidv4(),
                title: 'Levi\'s 511 Slim Jeans',
                description: 'Size 32/32. Only worn twice, essentially new.',
                price: 3500,
                category: 'fashion',
                condition: 'like_new',
                campus: 'south_campus',
                location: 'Fashion Lab Wing',
                image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'
            },
            {
                id: uuidv4(),
                title: 'Tutor: CS101 Python Basics',
                description: 'Offering 1-on-1 tutoring for introductory programming. $10 per hour.',
                price: 1000,
                category: 'services',
                condition: 'new',
                campus: 'all',
                location: 'Online / Library',
                image: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800'
            }
        ];

        for (const item of listings) {
            // Insert Listing
            await connection.query(
                `INSERT INTO marketplace_listings 
                (listing_id, seller_id, title, description, price, category, \`condition\`, campus, location, image_url, status, view_count) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
                [item.id, sellerId, item.title, item.description, item.price, item.category, item.condition, item.campus, item.location, item.image, Math.floor(Math.random() * 100)]
            );

            // Insert Media
            await connection.query(
                'INSERT INTO listing_media (media_id, listing_id, media_url, media_type, upload_order) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), item.id, item.image, 'image', 0]
            );
            
            console.log(`✅ Seeded: ${item.title}`);
        }

        console.log('✨ All sample data seeded successfully!');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

seed();
