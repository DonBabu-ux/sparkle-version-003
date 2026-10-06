// H23 — honest HTTP status mapping for token-refresh failures.
// DB/network trouble must surface as 503 (client keeps the session);
// only a genuinely dead refresh token may produce 401 (client logs out).
const { isDatabaseUnavailableError } = require('../config/database');

const DOMAIN_401 = /Invalid or expired refresh token|User not found|Refresh token is required/i;

const respondTokenRefreshError = (res, error) => {
    const message = error?.message || '';

    if (isDatabaseUnavailableError(error)) {
        return res.status(503).json({
            success: false,
            code: 'DATABASE_TEMPORARILY_UNAVAILABLE',
            message: 'Sparkle is temporarily unable to complete this request. Please try again shortly.'
        });
    }

    if (DOMAIN_401.test(message)) {
        return res.status(401).json({ status: 'error', message });
    }

    // Unknown server fault: 500 — the client must NOT treat this as logout.
    return res.status(500).json({ status: 'error', message: 'Internal error refreshing session' });
};

module.exports = { respondTokenRefreshError };
