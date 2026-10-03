// services/context.service.js - Safe User Context Builder
const logger = require('../utils/logger');

class ContextService {
    /**
     * Build sanitized user context block for AI prompt
     */
    static buildUserContext(reqUser) {
        if (!reqUser) return '';

        const userId = reqUser.user_id || reqUser.id;
        const username = reqUser.username || reqUser.name || 'Sparkle Member';
        const name = reqUser.name || reqUser.username || 'Sparkle Member';
        const campus = reqUser.campus || 'Main Campus';

        // STRICT SECURITY: Strip out passwords, hash keys, tokens, session IDs, internal emails
        return `AUTHENTICATED USER CONTEXT:
Name: ${name}
Username: ${username}
Campus: ${campus}
User ID: ${userId}`;
    }
}

module.exports = ContextService;
