/**
 * Utility to check if a user is verified based on their ID.
 * This list is managed in-memory to avoid database schema changes.
 */
const VERIFIED_USER_IDS = [
    "175a02d1-4707-44cd-a559-13a99cd5c8fe" // Sparkle CEO / Official Account
];

const isVerified = (userId) => {
    if (!userId) return false;
    return VERIFIED_USER_IDS.includes(userId);
};

module.exports = {
    isVerified,
    VERIFIED_USER_IDS
};
