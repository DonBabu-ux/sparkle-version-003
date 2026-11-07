'use strict';

require('dotenv').config();

const pool = require('../config/database');
const logger = require('../utils/logger');
const filterStore = require('../services/identityBloom/filterStore');
const redisClient = require('../services/identityBloom/redisClient');
const metrics = require('../services/identityBloom/metrics');
const { getConfig } = require('../services/identityBloom/config');
const {
    normalizeUsername,
    normalizeEmail,
    createIdentityHmac,
    isIdentityHmacConfigured
} = require('../utils/identity/identity');

const IDENTITY_TYPES = ['username', 'email'];
const SAMPLE_SIZE = 50;

function parseArgs(argv) {
    const args = { targetVersion: null, switchActive: false, resume: true, dryRun: false };
    for (let i = 2; i < argv.length; i++) {
        const value = argv[i];
        if (value === '--version') {
            args.targetVersion = argv[++i] || null;
        } else if (value === '--switch') {
            args.switchActive = true;
        } else if (value === '--no-resume') {
            args.resume = false;
        } else if (value === '--dry-run') {
            args.dryRun = true;
        }
    }
    return args;
}

async function fetchUsersBatch(afterUserId, batchSize) {
    const [rows] = await pool.query(
        `SELECT user_id, username, email
         FROM users
         WHERE user_id > ?
         ORDER BY user_id ASC
         LIMIT ${Math.max(1, Math.min(5000, batchSize))}`,
        [afterUserId || '']
    );
    return rows;
}

async function countEligibleIdentities() {
    const [rows] = await pool.query(
        `SELECT
            COUNT(*) AS total_users,
            SUM(CASE WHEN username IS NOT NULL AND username <> '' THEN 1 ELSE 0 END) AS usernames,
            SUM(CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) AS emails
         FROM users`
    );
    return rows[0] || { total_users: 0, usernames: 0, emails: 0 };
}

function buildIdentityPairs(rows) {
    const usernamePairs = [];
    const emailPairs = [];
    for (const row of rows) {
        const username = normalizeUsername(row.username);
        if (username) {
            usernamePairs.push({ value: username, hmac: createIdentityHmac('username', username) });
        }
        const email = normalizeEmail(row.email);
        if (email) {
            emailPairs.push({ value: email, hmac: createIdentityHmac('email', email) });
        }
    }
    return { usernamePairs, emailPairs };
}

function geometrySignature(config) {
    return `${config.bits}:${config.hashCount}`;
}

async function readResumeState(version, config, args) {
    if (!args.resume) return null;
    const progress = await filterStore.readRebuildProgress(version);
    if (!progress || progress.completed) return null;
    if (progress.geometry !== geometrySignature(config)) {
        logger.warn('[IdentityBloomRebuild] Stored progress uses a different geometry - restarting the rebuild.');
        return null;
    }
    if (!progress.cursor) return null;
    logger.info(`[IdentityBloomRebuild] Resuming from cursor at ${progress.cursor} (${progress.processedRows || 0} rows already applied).`);
    return progress;
}

async function validateFilter(identityType, version, samplePairs) {
    const bitCount = await filterStore.countFilterBits(identityType, version);
    let missing = 0;
    for (const pair of samplePairs.slice(0, 25)) {
        const present = await filterStore.probeBitsAtVersion(identityType, pair.value, version);
        if (!present) {
            missing += 1;
        }
    }
    return { identityType, version, bitCount, missingSamples: missing, ok: missing === 0 && bitCount > 0 };
}

async function run() {
    const args = parseArgs(process.argv);
    const config = getConfig();

    if (!isIdentityHmacConfigured()) {
        logger.error('SPARKLE_IDENTITY_BLOOM_HMAC_SECRET is missing or too short. Aborting rebuild.');
        process.exitCode = 1;
        return;
    }
    if (!redisClient.isConfigured()) {
        logger.error('No Redis provider configured. Aborting rebuild.');
        process.exitCode = 1;
        return;
    }

    const targetVersion = args.targetVersion || `${config.configuredVersion}.rebuild${Date.now()}`;
    const startedAt = Date.now();

    logger.info(`[IdentityBloomRebuild] Target version: ${targetVersion}`);
    logger.info(`[IdentityBloomRebuild] Geometry: capacity=${config.capacity} errorRate=${config.errorRate} bits=${config.bits} hashes=${config.hashCount}`);

    const counts = await countEligibleIdentities();
    logger.info(`[IdentityBloomRebuild] Eligible identities: ${JSON.stringify(counts)}`);

    if (args.dryRun) {
        logger.info('[IdentityBloomRebuild] Dry run - no Redis writes performed.');
        return;
    }

    const resumeState = await readResumeState(targetVersion, config, args);
    let cursor = resumeState ? resumeState.cursor : '';
    let processedRows = resumeState ? (resumeState.processedRows || 0) : 0;
    let processedUsernames = resumeState ? (resumeState.processedUsernames || 0) : 0;
    let processedEmails = resumeState ? (resumeState.processedEmails || 0) : 0;
    const samples = { username: [], email: [] };

    for (const identityType of IDENTITY_TYPES) {
        await filterStore.preallocateFilter(identityType, targetVersion);
    }
    logger.info('[IdentityBloomRebuild] Preallocated bit arrays.');

    for (;;) {
        const batch = await fetchUsersBatch(cursor, config.rebuildBatchSize);
        if (batch.length === 0) break;

        cursor = batch[batch.length - 1].user_id;
        processedRows += batch.length;

        const { usernamePairs, emailPairs } = buildIdentityPairs(batch);

        if (usernamePairs.length > 0) {
            await filterStore.insertIdentityBatch('username', targetVersion, usernamePairs.map((p) => p.hmac));
            processedUsernames += usernamePairs.length;
            if (samples.username.length < SAMPLE_SIZE) {
                samples.username.push(...usernamePairs.slice(0, SAMPLE_SIZE - samples.username.length));
            }
        }
        if (emailPairs.length > 0) {
            await filterStore.insertIdentityBatch('email', targetVersion, emailPairs.map((p) => p.hmac));
            processedEmails += emailPairs.length;
            if (samples.email.length < SAMPLE_SIZE) {
                samples.email.push(...emailPairs.slice(0, SAMPLE_SIZE - samples.email.length));
            }
        }

        await filterStore.setRebuildProgress(targetVersion, {
            version: targetVersion,
            geometry: geometrySignature(config),
            cursor,
            processedRows,
            processedUsernames,
            processedEmails,
            completed: false,
            updatedAt: new Date().toISOString()
        });

        logger.info(`[IdentityBloomRebuild] Applied ${processedRows} user rows (${processedUsernames} usernames, ${processedEmails} emails).`);
    }

    const durationMs = Date.now() - startedAt;
    logger.info(`[IdentityBloomRebuild] Inserted ${processedUsernames} username and ${processedEmails} email identities in ${durationMs}ms.`);

    for (const identityType of IDENTITY_TYPES) {
        const validation = await validateFilter(identityType, targetVersion, samples[identityType]);
        if (!validation.ok) {
            logger.error(`[IdentityBloomRebuild] Validation failed for ${identityType}: ${JSON.stringify(validation)}`);
            process.exitCode = 1;
            return;
        }
        await filterStore.setFilterReady(identityType, targetVersion, {
            sourceCount: identityType === 'username' ? processedUsernames : processedEmails,
            durationMs
        });
        logger.info(`[IdentityBloomRebuild] ${identityType} filter validated and marked ready (bits=${validation.bitCount}).`);
    }

    metrics.increment('rebuildRuns');
    metrics.increment('rebuildIdentities', processedUsernames + processedEmails);
    metrics.setGauge('rebuildDurationMs', durationMs);
    metrics.setGauge('lastRebuildAt', new Date().toISOString());

    await filterStore.setRebuildProgress(targetVersion, {
        version: targetVersion,
        geometry: geometrySignature(config),
        cursor,
        processedRows,
        processedUsernames,
        processedEmails,
        durationMs,
        completed: true,
        completedAt: new Date().toISOString()
    });

    if (args.switchActive) {
        const current = await filterStore.resolveActiveVersions(true);
        await filterStore.switchActiveVersion({
            username: targetVersion,
            email: targetVersion,
            previousUsername: current.username,
            previousEmail: current.email
        });
        logger.info(`[IdentityBloomRebuild] Active version switched to ${targetVersion}.`);
    } else {
        logger.info(`[IdentityBloomRebuild] Replacement filter ${targetVersion} is ready but NOT active. Re-run with --switch to promote it.`);
    }

    logger.info(`[IdentityBloomRebuild] Completed in ${durationMs}ms.`);
}

run()
    .catch((error) => {
        logger.error(`[IdentityBloomRebuild] Failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        try { await pool.end(); } catch (_) { /* ignore */ }
        try { redisClient.close(); } catch (_) { /* ignore */ }
    });
