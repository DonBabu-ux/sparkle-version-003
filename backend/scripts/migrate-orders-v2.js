// scripts/migrate-orders-v2.js
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  console.log('🔧 Starting Sparkle Marketplace Migration v2...\n');

  try {
    // Start transaction
    await connection.beginTransaction();

    // 1. Create marketplace_favorite_sellers table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS marketplace_favorite_sellers (
        favorite_id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        seller_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_seller (user_id, seller_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_user_favorites (user_id),
        INDEX idx_seller_followers (seller_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Created marketplace_favorite_sellers table');

    // 2. Add missing columns to marketplace_listings
    // Note: image_url might already exist from previous steps, so we use IF NOT EXISTS logic
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.columns 
      WHERE table_schema = ? AND table_name = 'marketplace_listings'`, 
      [process.env.DB_NAME]
    );
    const existingColumns = columns.map(c => c.COLUMN_NAME);

    if (!existingColumns.includes('image_url')) {
      await connection.query('ALTER TABLE marketplace_listings ADD COLUMN image_url VARCHAR(500) AFTER tags');
      console.log('✅ Added image_url to marketplace_listings');
    }
    if (!existingColumns.includes('boost_count')) {
      await connection.query('ALTER TABLE marketplace_listings ADD COLUMN boost_count INT DEFAULT 0 AFTER image_url');
      console.log('✅ Added boost_count to marketplace_listings');
    }
    if (!existingColumns.includes('last_boosted_at')) {
      await connection.query('ALTER TABLE marketplace_listings ADD COLUMN last_boosted_at TIMESTAMP NULL AFTER boost_count');
      console.log('✅ Added last_boosted_at to marketplace_listings');
    }
    if (!existingColumns.includes('is_promoted')) {
      await connection.query('ALTER TABLE marketplace_listings ADD COLUMN is_promoted TINYINT(1) DEFAULT 0 AFTER last_boosted_at');
      console.log('✅ Added is_promoted to marketplace_listings');
    }

    // 3. Create marketplace_orders table with proper constraints
    await connection.query(`
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        order_id CHAR(36) PRIMARY KEY,
        listing_id CHAR(36) NOT NULL,
        buyer_id CHAR(36) NOT NULL,
        seller_id CHAR(36) NOT NULL,
        listing_title VARCHAR(255) NOT NULL,
        listing_description TEXT,
        price_at_time DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'KES',
        item_condition VARCHAR(50),
        status ENUM('pending','accepted','rejected','cancelled','completed','disputed') DEFAULT 'pending',
        accepted_at TIMESTAMP NULL,
        rejected_at TIMESTAMP NULL,
        cancelled_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        disputed_at TIMESTAMP NULL,
        agreed_price DECIMAL(12,2) NULL,
        campus VARCHAR(100),
        location_description TEXT,
        scheduled_time TIMESTAMP NULL,
        meetup_confirmed_by_buyer TINYINT(1) DEFAULT 0,
        meetup_confirmed_by_seller TINYINT(1) DEFAULT 0,
        cancelled_by CHAR(36) NULL,
        cancellation_reason TEXT,
        last_action_by CHAR(36),
        last_action_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- Constraints
        CONSTRAINT chk_price_positive CHECK (price_at_time >= 0),
        CONSTRAINT chk_buyer_not_seller CHECK (buyer_id != seller_id),
        CONSTRAINT chk_agreed_price_positive CHECK (agreed_price >= 0 OR agreed_price IS NULL),
        
        -- Foreign Keys
        FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE RESTRICT,
        FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE RESTRICT,
        FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE RESTRICT,
        FOREIGN KEY (cancelled_by) REFERENCES users(user_id) ON DELETE SET NULL,
        FOREIGN KEY (last_action_by) REFERENCES users(user_id) ON DELETE SET NULL,
        
        -- Indexes
        INDEX idx_buyer_orders (buyer_id, created_at),
        INDEX idx_seller_orders (seller_id, created_at),
        INDEX idx_listing_status (listing_id, status),
        INDEX idx_status_created (status, created_at),
        INDEX idx_meetup_confirmation (meetup_confirmed_by_buyer, meetup_confirmed_by_seller),
        INDEX idx_scheduled_time (scheduled_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Created/updated marketplace_orders table');

    // 4. Create order_disputes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_disputes (
        dispute_id CHAR(36) PRIMARY KEY,
        order_id CHAR(36) NOT NULL,
        raised_by CHAR(36) NOT NULL,
        reason VARCHAR(100) NOT NULL,
        description TEXT,
        status ENUM('open','investigating','resolved','closed') DEFAULT 'open',
        resolution_notes TEXT,
        resolved_by CHAR(36) NULL,
        resolved_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (order_id) REFERENCES marketplace_orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (raised_by) REFERENCES users(user_id) ON DELETE RESTRICT,
        FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL,
        
        INDEX idx_order_disputes (order_id),
        INDEX idx_dispute_status (status),
        INDEX idx_raised_by (raised_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Created order_disputes table');

    // 5. Create order_audit_log table with compression
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_audit_log (
        log_id CHAR(36) PRIMARY KEY,
        order_id CHAR(36) NOT NULL,
        actor_id CHAR(36) NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_status VARCHAR(20),
        new_status VARCHAR(20),
        changes JSON,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (order_id) REFERENCES marketplace_orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE RESTRICT,
        
        INDEX idx_order_audit (order_id, created_at),
        INDEX idx_actor_audit (actor_id, created_at),
        INDEX idx_action_time (action, created_at)
      ) ENGINE=InnoDB ROW_FORMAT=COMPRESSED DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Created order_audit_log table');

    // 6. Verify all tables exist
    const tables = [
      'marketplace_favorite_sellers',
      'marketplace_orders',
      'order_disputes', 
      'order_audit_log'
    ];

    console.log('\n🔍 Verifying tables...');
    for (const table of tables) {
      const [rows] = await connection.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
        [process.env.DB_NAME, table]
      );
      
      if (rows[0].count > 0) {
        console.log(`  ✅ ${table} exists`);
      } else {
        console.log(`  ❌ ${table} missing!`);
        throw new Error(`Table ${table} was not created`);
      }
    }

    // 7. Commit transaction
    await connection.commit();
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration().then(() => {
  console.log('\n🎉 Sparkle Marketplace database is up to date!');
  process.exit(0);
}).catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
