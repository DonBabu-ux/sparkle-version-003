// config/postgres.js - Sparkly Knowledge Engine PostgreSQL Connection Pool (AlwaData)
const logger = require('../utils/logger');

let pg;
try {
    pg = require('pg');
} catch (e) {
    logger.warn('[PostgreSQL] pg package not yet loaded or missing. Postgres pool will remain inactive until installed.');
}

const { Pool } = pg || {};

const host = process.env.SPARKLY_DATABASE_HOST || process.env.PGHOST;
const port = parseInt(process.env.SPARKLY_DATABASE_PORT || process.env.PGPORT || '5432', 10);
const database = process.env.SPARKLY_DATABASE_NAME || process.env.PGDATABASE;
const user = process.env.SPARKLY_DATABASE_USER || process.env.PGUSER;
const password = process.env.SPARKLY_DATABASE_PASSWORD || process.env.PGPASSWORD;
const useSsl = process.env.SPARKLY_DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';

let pool = null;
let tablesCreated = false;

function isPostgresConfigured() {
    return Boolean(host && database && user && Pool);
}

function getPostgresPool() {
    if (pool) return pool;

    if (!isPostgresConfigured()) {
        logger.info('[PostgreSQL] Database credentials unconfigured in .env — Knowledge Engine running in local fallback mode.');
        return null;
    }

    try {
        pool = new Pool({
            host,
            port,
            database,
            user,
            password,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            ssl: useSsl ? { rejectUnauthorized: false } : false
        });

        pool.on('error', (err) => {
            logger.error('[PostgreSQL] Unexpected error on idle client:', err.message);
        });

        logger.info(`[PostgreSQL] Connection pool initialized for AlwaData database: ${database} at ${host}:${port}`);
        return pool;
    } catch (err) {
        logger.error('[PostgreSQL] Failed to initialize pool:', err.message);
        pool = null;
        return null;
    }
}

/**
 * Execute parameterized query on PostgreSQL with error handling and fallback
 */
async function pgQuery(text, params = []) {
    const p = getPostgresPool();
    if (!p) {
        logger.debug('[PostgreSQL] Query skipped — pool not configured or unavailable');
        return null;
    }

    try {
        const start = Date.now();
        const res = await p.query(text, params);
        const duration = Date.now() - start;
        logger.debug(`[PostgreSQL] Executed query in ${duration}ms: ${text.substring(0, 80)}`);
        return res;
    } catch (err) {
        logger.error('[PostgreSQL] Query error:', { text: text.substring(0, 100), error: err.message });
        throw err;
    }
}

/**
 * Auto-ensure PostgreSQL knowledge tables exist
 */
async function ensurePostgresTablesExist() {
    if (tablesCreated || !isPostgresConfigured()) return;
    try {
        await pgQuery(`
            CREATE TABLE IF NOT EXISTS sparkly_knowledge_categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                slug VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sparkly_knowledge_documents (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category_id INT REFERENCES sparkly_knowledge_categories(id) ON DELETE SET NULL,
                content TEXT NOT NULL,
                source VARCHAR(255) DEFAULT 'manual',
                status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
                version INT DEFAULT 1,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sparkly_knowledge_chunks (
                id SERIAL PRIMARY KEY,
                document_id INT NOT NULL REFERENCES sparkly_knowledge_documents(id) ON DELETE CASCADE,
                chunk_index INT NOT NULL,
                content TEXT NOT NULL,
                keywords TEXT[] DEFAULT '{}',
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sparkly_knowledge_sources (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50) DEFAULT 'raw_text',
                uri VARCHAR(255),
                last_synced_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        tablesCreated = true;
        logger.info('[PostgreSQL] Verified knowledge database schema & tables.');
    } catch (err) {
        logger.warn('[PostgreSQL] Table migration check warning:', err.message);
    }
}

/**
 * Check health status of PostgreSQL connection pool
 */
async function checkPgHealth() {
    if (!isPostgresConfigured()) {
        return { status: 'unconfigured', message: 'PostgreSQL environment variables not set' };
    }
    const p = getPostgresPool();
    if (!p) {
        return { status: 'disconnected', message: 'Pool initialization failed' };
    }
    try {
        const res = await p.query('SELECT 1 as alive, NOW() as server_time');
        return {
            status: 'connected',
            serverTime: res.rows[0]?.server_time,
            totalCount: p.totalCount,
            idleCount: p.idleCount,
            waitingCount: p.waitingCount
        };
    } catch (err) {
        return { status: 'error', message: err.message };
    }
}

// Graceful shutdown on SIGINT/SIGTERM
async function closePgPool() {
    if (pool) {
        try {
            await pool.end();
            logger.info('[PostgreSQL] Connection pool closed gracefully.');
            pool = null;
        } catch (err) {
            logger.error('[PostgreSQL] Error closing pool:', err.message);
        }
    }
}

process.on('SIGINT', closePgPool);
process.on('SIGTERM', closePgPool);

module.exports = {
    getPostgresPool,
    pgQuery,
    isPostgresConfigured,
    ensurePostgresTablesExist,
    checkPgHealth,
    closePgPool
};
