const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        ticket_id VARCHAR(64) NOT NULL,
        sender_id VARCHAR(36) NOT NULL,
        sender_name VARCHAR(100) NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        message TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_stm_ticket (ticket_id),
        INDEX idx_stm_sender (sender_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('support_ticket_messages ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_faqs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        question VARCHAR(500) NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'general',
        is_published TINYINT(1) NOT NULL DEFAULT 1,
        helpful_count INT UNSIGNED NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sf_cat (category),
        INDEX idx_sf_pub (is_published)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('support_faqs ready');

    const [existing] = await pool.query('SELECT COUNT(*) as cnt FROM support_faqs');
    if (existing[0]?.cnt === 0) {
      await pool.query(`
        INSERT INTO support_faqs (question, answer, category, sort_order) VALUES
        ('How do I create a Sparkle account?', 'Download the Sparkle app and tap \"Sign Up\". Enter your name, email address, and choose a password. Check your inbox for our verification email to activate your profile.', 'getting-started', 1),
        ('How do I reset my password?', 'On the login screen, tap \"Forgot Password\" and enter your registered email address. We will send a secure password reset link valid for 1 hour.', 'account', 2),
        ('How do I report a user, post, or circle?', 'Tap the three dots (⋯) on any post, comment, or profile. Choose \"Report\" and select the relevant reason. Our moderation team reviews reports promptly.', 'privacy', 3),
        ('How does the Marketplace work?', 'Open Marketplace from the bottom navigation. Search or browse listings. To list an item, tap \"Sell Item\" and add photos, price, and campus location. Transactions are peer-to-peer.', 'marketplace', 4),
        ('Can I delete my account?', 'Go to Settings → Account Control → Delete Account. Confirm with your password. A 30-day grace period is provided before permanent deletion.', 'account', 5),
        ('How do I go live on Sparkle?', 'You need at least 1,000 followers. Navigate to Live Streams, click \"Go Live\", grant camera and microphone access, and start broadcasting.', 'live', 6),
        ('Why are my posts or messages not loading?', 'Check your Wi-Fi or mobile data connection. Pull down to refresh or clear your app cache. If problems persist, submit a ticket in Help Centre.', 'technical', 7),
        ('How do I contact official Sparkle Support?', 'Submit a ticket directly in Help Centre, chat with our AI Support Assistant, or send an email to lilbeelogics@gmail.com.', 'general', 8)
      `);
      console.log('Default FAQs inserted');
    }
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    process.exit(0);
  }
}

run();

