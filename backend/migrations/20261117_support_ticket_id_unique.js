// migrations/20261117_support_ticket_id_unique.js
require('dotenv').config();
const pool = require('../config/database');

async function migrateTicketIdUnique() {
  const [dups] = await pool.query(
    'SELECT ticket_id, COUNT(*) AS n FROM support_requests WHERE ticket_id IS NOT NULL GROUP BY ticket_id HAVING n > 1'
  );
  if (dups.length > 0) {
    console.error('[migrate] duplicate ticket_ids exist — resolve them first:', dups.map(d => d.ticket_id).join(', '));
    process.exit(1);
  }

  const [existing] = await pool.query(
    "SHOW INDEX FROM support_requests WHERE Key_name = 'uniq_support_ticket_id'"
  );
  if (existing.length > 0) {
    console.log('[migrate] uniq_support_ticket_id already present.');
  } else {
    await pool.query('ALTER TABLE support_requests ADD UNIQUE KEY uniq_support_ticket_id (ticket_id)');
    console.log('[migrate] uniq_support_ticket_id added.');
  }
  console.log('[migrate] done.');
}

migrateTicketIdUnique()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[migrate] FAILED:', err.message); process.exit(1); });