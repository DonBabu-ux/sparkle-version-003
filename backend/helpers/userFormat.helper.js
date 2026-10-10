/**
 * userFormat.helper.js
 * Analyzes and formats user data to abstract campus fields into general affiliation/interests
 * without changing the underlying DB schema.
 */

function getUserType(user) {
    if (!user) return 'general_user';
    const hasCampus = !!user.campus;
    const hasMajor = !!user.major;
    const hasYear = !!user.year_of_study;

    if (hasCampus && hasMajor && hasYear) return 'student';
    if (hasMajor) return 'professional';
    if (hasCampus) return 'community_member';
    return 'general_user';
}

function formatUserDisplay(user) {
    if (!user) return null;

    const userType = getUserType(user);
    const display = { ...user, userType };

    if (userType === 'student') {
        display.campus = `${user.major} @ ${user.campus}`;
        display.year_of_study = user.year_of_study;
    } else if (userType === 'professional') {
        display.campus = user.major;
        display.year_of_study = null;
    } else if (userType === 'community_member') {
        display.campus = user.campus;
        display.year_of_study = null;
    } else {
        display.campus = 'Explorer';
        display.year_of_study = null;
    }

    return display;
}

module.exports = {
    getUserType,
    formatUserDisplay
};
