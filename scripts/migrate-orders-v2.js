/**
 * migrate-orders-v2.js
 * Run: node scripts/migrate-orders-v2.js
 *
 * Creates the production-grade marketplace orders tables
 * with full audit trail and KES currency support.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const pool = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    });

    console.log('🔌 Connected to MySQL...');

    try {
        // ── 1. marketplace_orders ──────────────────────────────────────────
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS marketplace_orders (
                order_id       CHAR(36)         NOT NULL,
                listing_id     CHAR(36)         NOT NULL,
                buyer_id       CHAR(36)         NOT NULL,
                seller_id      CHAR(36)         NOT NULL,

                -- Snapshot (immutable once created)
                listing_title       VARCHAR(255)     NOT NULL,
                listing_description TEXT,
                price_at_time       DECIMAL(12,2)    NOT NULL COMMENT 'KES',
                currency            VARCHAR(3)       DEFAULT 'KES',
                item_condition      VARCHAR(50),

                -- Lifecycle status
                status ENUM(
                    'pending','accepted','rejected',
                    'cancelled','completed','disputed'
                ) NOT NULL DEFAULT 'pending',

                -- Status timestamps
                accepted_at   TIMESTAMP NULL,
                rejected_at   TIMESTAMP NULL,
                cancelled_at  TIMESTAMP NULL,
                completed_at  TIMESTAMP NULL,
                disputed_at   TIMESTAMP NULL,

                -- Negotiation
                agreed_price DECIMAL(12,2) NULL COMMENT 'KES',

                -- Meetup
                campus                      VARCHAR(100),
                location_description        TEXT,
                scheduled_time              TIMESTAMP NULL,
                meetup_confirmed_by_buyer   TINYINT(1) DEFAULT 0,
                meetup_confirmed_by_seller  TINYINT(1) DEFAULT 0,

                -- Cancellation
                cancelled_by         CHAR(36)  NULL,
                cancellation_reason  TEXT,

                -- Audit
                last_action_by  CHAR(36)  NULL,
                last_action_at  TIMESTAMP NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                -- Keys & Constraints
                PRIMARY KEY (order_id),
                CONSTRAINT fk_mo_listing
                    FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE RESTRICT,
                CONSTRAINT fk_mo_buyer
                    FOREIGN KEY (buyer_id)   REFERENCES users(user_id) ON DELETE RESTRICT,
                CONSTRAINT fk_mo_seller
                    FOREIGN KEY (seller_id)  REFERENCES users(user_id) ON DELETE RESTRICT,
                CONSTRAINT fk_mo_cancelled_by
                    FOREIGN KEY (cancelled_by) REFERENCES users(user_id) ON DELETE SET NULL,

                INDEX idx_mo_buyer   (buyer_id,   created_at),
                INDEX idx_mo_seller  (seller_id,  created_at),
                INDEX idx_mo_listing (listing_id, status),
                INDEX idx_mo_status  (status,     created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            COMMENT='Production marketplace orders – prices in KES'
        `);
        console.log('✅  marketplace_orders table ready');

        // ── 2. order_disputes ──────────────────────────────────────────────
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS order_disputes (
                dispute_id       CHAR(36) NOT NULL,
                order_id         CHAR(36) NOT NULL,
                raised_by        CHAR(36) NOT NULL,
                reason           VARCHAR(100) NOT NULL,
                description      TEXT,
                status           ENUM('open','investigating','resolved','closed') DEFAULT 'open',
                resolution_notes TEXT,
                resolved_by      CHAR(36) NULL,
                resolved_at      TIMESTAMP NULL,
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                PRIMARY KEY (dispute_id),
                CONSTRAINT fk_od_order       FOREIGN KEY (order_id)    REFERENCES marketplace_orders(order_id) ON DELETE CASCADE,
                CONSTRAINT fk_od_raised_by   FOREIGN KEY (raised_by)   REFERENCES users(user_id) ON DELETE RESTRICT,
                CONSTRAINT fk_od_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(user_id) ON DELETE SET NULL,
                INDEX idx_od_order  (order_id),
                INDEX idx_od_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅  order_disputes table ready');

        // ── 3. order_audit_log ─────────────────────────────────────────────
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS order_audit_log (
                log_id      CHAR(36)    NOT NULL,
                order_id    CHAR(36)    NOT NULL,
                actor_id    CHAR(36)    NOT NULL,
                action      VARCHAR(50) NOT NULL,
                old_status  VARCHAR(20),
                new_status  VARCHAR(20),
                changes     JSON,
                ip_address  VARCHAR(45),
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                PRIMARY KEY (log_id),
                CONSTRAINT fk_oal_order FOREIGN KEY (order_id)  REFERENCES marketplace_orders(order_id) ON DELETE CASCADE,
                CONSTRAINT fk_oal_actor FOREIGN KEY (actor_id)  REFERENCES users(user_id)               ON DELETE RESTRICT,
                INDEX idx_oal_order (order_id, created_at),
                INDEX idx_oal_actor (actor_id, created_at)
            ) ENGINE=InnoDB ROW_FORMAT=COMPRESSED DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅  order_audit_log table ready');

        // ── 4. marketplace_favorite_sellers (if missing) ───────────────────
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS marketplace_favorite_sellers (
                favorite_id CHAR(36)  NOT NULL,
                user_id     CHAR(36)  NOT NULL,
                seller_id   CHAR(36)  NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (favorite_id),
                UNIQUE KEY unique_fav_seller (user_id, seller_id),
                FOREIGN KEY (user_id)   REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅  marketplace_favorite_sellers table ready');

        // ── 5. Add missing columns to marketplace_listings if needed ───────
        const alterCols = [
            "ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS boost_count INT DEFAULT 0",
            "ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS last_boosted_at TIMESTAMP NULL",
            "ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS is_promoted TINYINT(1) DEFAULT 0",
            "ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) DEFAULT NULL"
        ];
        for (const sql of alterCols) {
            try { await pool.execute(sql); } catch(e) { /* column already exists */ }
        }
        console.log('✅  marketplace_listings columns ensured');

        console.log('\n🎉 Migration complete! All marketplace orders tables are ready.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
