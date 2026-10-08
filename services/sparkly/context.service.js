// services/sparkly/context.service.js
// Assembles controlled user and application context without exposing internal secrets

const { SafetyService } = require('./safety.service');

class ContextService {
    /**
     * Build structured user context string
     */
    static buildUserContext(user, clientContext = {}) {
        if (!user) {
            return `USER CONTEXT:
Anonymous Guest
Language: English
Region: Kenya (Default)`;
        }

        const username = user.username || 'Sparkle Member';
        const displayName = user.name || user.display_name || user.username || 'Sparkle Member';
        const campus = user.campus || clientContext.campus || 'Main Campus';
        const language = user.language || 'English';

        let contextLines = [
            `USER CONTEXT:`,
            `- Username: @${username}`,
            `- Display Name: ${displayName}`,
            `- Campus: ${campus}`,
            `- Language: ${language}`,
            `- Region: Kenya (Prices in KSh / KES)`
        ];

        if (clientContext.screen) {
            contextLines.push(`- Current Screen: ${clientContext.screen}`);
        }

        if (clientContext.feature) {
            contextLines.push(`- Current Feature: ${clientContext.feature}`);
        }

        if (clientContext.listingId) {
            contextLines.push(`- Currently Viewing Listing ID: ${clientContext.listingId}`);
        }

        return contextLines.join('\n');
    }

    /**
     * Build complete context block combining User Context, Sparkle Data, and Web Data
     */
    static buildPromptContext({ userContext, sparkleData = null, webData = null, memoryBlock = '' }) {
        let blocks = [];

        if (userContext) {
            blocks.push(userContext);
        }

        if (memoryBlock) {
            blocks.push(`USER PREFERENCES & MEMORY:\n${memoryBlock}`);
        }

        if (sparkleData) {
            blocks.push(SafetyService.wrapDelimitedSection('SPARKLE_DATA', sparkleData));
        }

        if (webData) {
            blocks.push(SafetyService.wrapDelimitedSection('WEB_DATA', webData));
        }

        return blocks.join('\n\n');
    }
}

module.exports = ContextService;
