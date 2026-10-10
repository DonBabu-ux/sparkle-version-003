// utils/analytics.js
const logger = require('./logger');
const { safeQuery } = require('../config/database');
const crypto = require('crypto');

/**
 * Log onboarding and auth events.
 * @param {string} eventType 
 * @param {string|null} userId 
 * @param {Object} [metadata={}] 
 */
async function logEvent(eventType, userId = null, metadata = {}) {
    logger.info(`[Analytics] Event: ${eventType} | User: ${userId || 'guest'}`, metadata);
    
    // Only insert into onboarding_events if userId is provided (due to FK NOT NULL constraint)
    if (userId) {
        try {
            await safeQuery(
                'INSERT INTO onboarding_events (event_id, user_id, event_type, metadata) VALUES (?, ?, ?, ?)',
                [crypto.randomUUID(), userId, eventType, JSON.stringify(metadata)]
            );
        } catch (error) {
            logger.error(`[Analytics] Failed to write event to DB: ${error.message}`);
        }
    }
}

module.exports = { logEvent };
