/**
 * helpers/systemAccount.helper.js
 * Sparkle Official Account System Platform Helper
 * Standardizes official account detection, identity presentation, and multi-account ecosystem mapping.
 */

'use strict';

const SYSTEM_USER_ID = process.env.SPARKLE_SYSTEM_USER_ID || process.env.SYSTEM_USER_ID || 'd75fe3b5-7a45-4581-ab13-91934d8b54de';
const SYSTEM_AVATAR = '/assets/system/sparkle-logo.svg';

// Multi-Account Official Ecosystem Registry
const OFFICIAL_ECOSYSTEM_ACCOUNTS = {
    'sparkle_updates': {
        id: SYSTEM_USER_ID,
        name: 'Sparkle Official',
        username: 'sparkleofficial',
        user_handle: '@sparkleofficial',
        bio: 'Official Sparkle Account • Helping you discover Sparkle.',
        category: 'updates',
        icon: 'Sparkles',
        badge: 'Official',
        accentColor: '#f43f5e'
    },
    'sparkle_safety': {
        id: 'd75fe3b5-7a45-4581-ab13-91934d8b54df',
        name: 'Sparkle Safety & Security',
        username: 'sparklesafety',
        user_handle: '@sparklesafety',
        bio: 'Official Security Desk • Account security alerts, login notices, and safety guidelines.',
        category: 'security',
        icon: 'ShieldCheck',
        badge: 'Verified Security',
        accentColor: '#db2777'
    },
    'sparkle_ai': {
        id: 'd75fe3b5-7a45-4581-ab13-91934d8b54e0',
        name: 'Sparkle AI Assistant',
        username: 'sparkleai',
        user_handle: '@sparkleai',
        bio: 'Official AI Companion • Powered by Sparkle Intelligence to assist your campus life.',
        category: 'ai',
        icon: 'Wand2',
        badge: 'Official AI',
        accentColor: '#8b5cf6'
    },
    'sparkly_bot': {
        id: 'sparkly_bot',
        name: 'Sparkly AI Assistant',
        username: 'sparkly_bot',
        user_handle: '@sparkly_bot',
        bio: 'Official Sparkly AI Assistant • Sparkle Assistant for Marketplace & Chat.',
        category: 'ai',
        icon: 'Sparkles',
        badge: 'Official Sparkly',
        accentColor: '#8b5cf6'
    },
    'sparkle_support': {
        id: 'd75fe3b5-7a45-4581-ab13-91934d8b54e1',
        name: 'Sparkle Help & Support',
        username: 'sparklesupport',
        user_handle: '@sparklesupport',
        bio: 'Official Support Channel • Assistance with bug reports, account recovery, and inquiries.',
        category: 'support',
        icon: 'HelpCircle',
        badge: 'Support Desk',
        accentColor: '#0284c7'
    },
    'sparkle_marketplace': {
        id: 'd75fe3b5-7a45-4581-ab13-91934d8b54e2',
        name: 'Sparkle Marketplace Desk',
        username: 'sparklemarket',
        user_handle: '@sparklemarket',
        bio: 'Official Marketplace Desk • Safe trading tips, transaction updates, and seller guides.',
        category: 'marketplace',
        icon: 'ShoppingBag',
        badge: 'Verified Desk',
        accentColor: '#059669'
    },
    'sparkle_campus': {
        id: 'd75fe3b5-7a45-4581-ab13-91934d8b54e3',
        name: 'Sparkle Campus Network',
        username: 'sparklecampus',
        user_handle: '@sparklecampus',
        bio: 'Official Campus Desk • University announcements, club spotlights, and event updates.',
        category: 'campus',
        icon: 'GraduationCap',
        badge: 'Campus Desk',
        accentColor: '#d97706'
    },
    'sparkle_pay': {
        id: 'd75fe3b5-7a45-4581-ab13-91934d8b54e4',
        name: 'SparklePay',
        username: 'sparklepay',
        user_handle: '@sparklepay',
        bio: 'Verified Financial Channel • Wallet top-ups, subscriptions, payment receipts, and refunds.',
        category: 'finance',
        icon: 'CreditCard',
        badge: 'Verified Financial Channel',
        accentColor: '#10b981'
    }
};

const SYSTEM_USER_IDS = new Set(Object.values(OFFICIAL_ECOSYSTEM_ACCOUNTS).map(acc => acc.id));

const OFFICIAL_USERNAMES = new Set([
    'sparkleofficial',
    'sparklesafety',
    'sparkleai',
    'sparklesupport',
    'sparklemarket',
    'sparklecampus',
    'sparklepay',
    'sparkle',
    'sparkleofficialaccount'
]);

/**
 * Checks if a target user or ID is an official system account based on account_type, ID, or username.
 * @param {object|string} target 
 * @returns {boolean}
 */
function isSystemAccount(target) {
    if (!target) return false;
    
    if (typeof target === 'string') {
        const cleanStr = target.toLowerCase().replace(/^@/, '');
        return target === SYSTEM_USER_ID || SYSTEM_USER_IDS.has(target) || OFFICIAL_USERNAMES.has(cleanStr);
    }

    const userId = String(target.account_id || target.user_id || target.id || target.partner_id || target.participant_id || '');
    if (userId && (userId === SYSTEM_USER_ID || SYSTEM_USER_IDS.has(userId))) {
        return true;
    }

    const uname = String(target.username || target.partner_username || '').toLowerCase().replace(/^@/, '');
    if (uname && OFFICIAL_USERNAMES.has(uname)) {
        return true;
    }

    if (target.account_type === 'system' || target.is_system_account === 1 || target.is_system_account === true) {
        return true;
    }

    return false;
}

/**
 * Backward compatible wrapper for ID check
 */
function isSystemAccountId(userId) {
    return isSystemAccount(userId);
}

/**
 * Formats a user or conversation object into an official system account presentation layer
 * @param {object} user 
 * @returns {object}
 */
function formatSystemUser(user) {
    if (!user) return user;

    const isSys = isSystemAccount(user);
    if (!isSys) {
        return {
            ...user,
            account_type: user.account_type || 'user',
            is_system_account: false
        };
    }

    const uname = String(user.username || user.partner_username || '').toLowerCase().replace(/^@/, '');
    let ecosystemMatch = OFFICIAL_ECOSYSTEM_ACCOUNTS[uname];
    if (!ecosystemMatch) {
        const uId = String(user.user_id || user.id || user.partner_id || user.participant_id || '');
        ecosystemMatch = Object.values(OFFICIAL_ECOSYSTEM_ACCOUNTS).find(acc => acc.username === uname || String(acc.id) === uId) || OFFICIAL_ECOSYSTEM_ACCOUNTS['sparkle_updates'];
    }

    return {
        ...user,
        user_id: user.user_id || user.id || ecosystemMatch.id,
        id: user.id || user.user_id || ecosystemMatch.id,
        name: ecosystemMatch.name,
        display_name: ecosystemMatch.name,
        username: ecosystemMatch.username,
        user_handle: ecosystemMatch.user_handle,
        avatar_url: SYSTEM_AVATAR,
        avatar: SYSTEM_AVATAR,
        profile_picture: SYSTEM_AVATAR,
        is_verified: true,
        verified: true,
        is_system_account: true,
        account_type: 'system',
        user_type: 'system',
        account_status: 'active',
        bio: user.bio || ecosystemMatch.bio,
        official_badge: ecosystemMatch.badge,
        official_category: ecosystemMatch.category,
        accent_color: ecosystemMatch.accentColor
    };
}

module.exports = {
    SYSTEM_USER_ID,
    SYSTEM_AVATAR,
    OFFICIAL_ECOSYSTEM_ACCOUNTS,
    isSystemAccount,
    isSystemAccountId,
    formatSystemUser
};
