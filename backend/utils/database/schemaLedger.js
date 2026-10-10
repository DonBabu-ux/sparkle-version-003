const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../../config/database');
const logger = require('../logger');

const LEDGER_TABLE = 'schema_migrations';
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

// Files whose objects are verified missing and are executed by the runner.
// `verify`: tables that must exist after the run (some .js migrations swallow errors).
const MIGRATION_RUN = [
    { file: '20260801_create_rooms_schema.sql', verify: ['rooms', 'room_members', 'channel_messages'] },
    { file: '20260822_create_legal_consents.js', verify: ['user_legal_consents'] },
    { file: '20261008_add_users_is_hidden.sql', verify: [] }
];

// Dispositions for every other migration file, verified against the live schema.
const MIGRATION_NOTES = {
    '010_official_account_system_upgrade.sql': 'applied - users.account_type, personal_chats.conversation_type, messages.message_category/publish_at/expires_at/payload verified live',
    '20240523_add_message_read_status.sql': 'applied - message_read_status exists',
    '20240524_add_privacy_and_fcm.sql': 'applied - fcm_tokens exists',
    '20240701_create_push_notifications_table.sql': 'applied - push_notifications exists',
    '20241001_create_notifications_table.sql': 'applied - notifications exists; idx_user_category ensured by initPerfIndexes',
    '20241002_add_onboarding_and_system_user.sql': 'skipped - profile_reminder_* columns have zero code references; system accounts already seeded',
    '20260607_add_message_deletion.sql': 'applied - message_hidden exists; messages.deleted_for_everyone/deleted_at/deleted_by live',
    '20260630_add_feed_indexes.sql': 'skipped - target posts.is_deleted/is_hidden columns do not exist (sole consumer services/feed.service.js is dead code); sparks/comments indexes live; post_images table absent',
    '20260703_notification_platform.sql': 'applied - columns live; idx_user_category ensured by initPerfIndexes',
    '20260709_fix_onboarding_step_default.sql': 'applied - onboarding_step default already 0',
    '20260815_create_group_channels.sql': 'applied - group_channels + idx_gc_* live; seed complete (11/11 group chats have channels)',
    '20260820_rename_group_channels_to_channels.sql': 'skipped - breaking: app SQL targets group_channels (4 refs, 0 refs to channels)',
    '20260904_create_live_location_sessions.sql': 'applied - live_location_sessions exists',
    'postgres_knowledge.sql': 'skipped - PostgreSQL-only (GIN FTS); knowledge service uses pg pool',
    '20260823_enhance_message_deletions.js': 'applied - message_deletions + operation_id + messages.delete_operation_id live',
    'add_privacy_and_disappearing_columns.js': 'applied - chat_privacy_settings + privacy_version live',
    'add-username-normalized.js': 'applied - users.username_normalized live with unique index',
    'migrate-enterprise-messaging.js': 'applied - idx_server_seq, user_sessions, delivery_queue, message_reactions (+idx_msg_reactions, updated_at) live',
    'migrate-official-onboarding.js': 'applied - users.official_onboarding_status + messages.is_hidden/hidden_reason/message_type/archive_after_completion live',
    'migrate-privacy-versioning.js': 'applied - chat_privacy_settings.privacy_version, capture_attempts/notifications/audit_log live'
};

const listMigrationFiles = () => fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
    .sort();

// Version gate key: any change to the DDL source, this module, or the migration
// set invalidates the gate so the next boot runs one full (idempotent) pass.
const computeInitVersion = () => {
    const h = crypto.createHash('sha1');
    h.update(fs.readFileSync(path.join(__dirname, 'init.js')));
    h.update(fs.readFileSync(__filename));
    h.update(listMigrationFiles().join(','));
    return h.digest('hex').slice(0, 16);
};

const ensureLedgerTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
            name VARCHAR(191) NOT NULL PRIMARY KEY,
            note VARCHAR(1000) DEFAULT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
};

const ledgerHas = async (name) => {
    const [rows] = await pool.query(`SELECT 1 FROM ${LEDGER_TABLE} WHERE name = ? LIMIT 1`, [name]);
    return rows.length > 0;
};

const ledgerMark = async (name, note) => {
    await pool.query(`INSERT IGNORE INTO ${LEDGER_TABLE} (name, note) VALUES (?, ?)`, [
        name,
        note ? String(note).slice(0, 1000) : null
    ]);
};

// Split a .sql file into statements, honoring quotes and comments.
const splitStatements = (sql) => {
    const out = [];
    let cur = '';
    let state = null;
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = sql[i + 1];
        if (state) {
            cur += ch;
            if (ch === '\\' && state !== '`') {
                cur += next || '';
                i++;
            } else if (ch === state) {
                state = null;
            }
            continue;
        }
        if (ch === '-' && next === '-') {
            while (i < sql.length && sql[i] !== '\n') i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
            i++;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            state = ch;
            cur += ch;
            continue;
        }
        if (ch === ';') {
            out.push(cur);
            cur = '';
            continue;
        }
        cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map(s => s.trim()).filter(Boolean);
};

const runSqlFile = async (file) => {
    const raw = fs.readFileSync(file, 'utf8');
    for (let stmt of splitStatements(raw)) {
        // Migration files use bare CREATE TABLE; make them idempotent.
        stmt = stmt.replace(/^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ');
        try {
            await pool.query(stmt);
        } catch (e) {
            if (e && (e.errno === 1050 || /already exists/i.test(e.message || ''))) continue;
            throw e;
        }
    }
};

const runMigration = async (file) => {
    const full = path.join(MIGRATIONS_DIR, file);
    if (file.endsWith('.js')) {
        const fn = require(full);
        if (typeof fn === 'function') await fn();
        return;
    }
    await runSqlFile(full);
};

const assertTablesExist = async (tables) => {
    for (const t of tables) {
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [t]
        );
        if (Number(rows[0].n) === 0) {
            throw new Error(`migration verification failed: table ${t} missing after run`);
        }
    }
};

// Apply pending migrations and record a disposition for every file.
// Throws on failure so the version gate is not marked and the pass retries.
const reconcileMigrations = async () => {
    for (const f of listMigrationFiles()) {
        const key = `migration:${f}`;
        if (await ledgerHas(key)) continue;
        const runSpec = MIGRATION_RUN.find(r => r.file === f);
        if (runSpec) {
            logger.info(`[schema] running migration ${f}`);
            await runMigration(f);
            await assertTablesExist(runSpec.verify || []);
            await ledgerMark(key, 'applied by schema runner');
            logger.info(`[schema] applied ${f}`);
        } else if (MIGRATION_NOTES[f]) {
            await ledgerMark(key, MIGRATION_NOTES[f]);
            logger.info(`[schema] recorded ${f}: ${MIGRATION_NOTES[f]}`);
        } else {
            logger.warn(`[schema] migration ${f} has no disposition - add it to MIGRATION_RUN or MIGRATION_NOTES in schemaLedger.js`);
            await ledgerMark(key, 'unreviewed - needs disposition in schemaLedger.js');
        }
    }
};

module.exports = {
    computeInitVersion,
    ensureLedgerTable,
    ledgerHas,
    ledgerMark,
    reconcileMigrations
};
