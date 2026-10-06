// H24 — socket handshake error messages.
// The auth middleware does a DB lookup (User.findById); a DB blip there must
// NOT masquerade as "Invalid token" (clients would refresh-loop on a perfectly
// valid JWT). Map it to ServiceUnavailable so clients just let socket.io retry.
const { isDatabaseUnavailableError } = require('../config/database');

const socketAuthErrorMessage = (error) => {
    if (error?.name === 'TokenExpiredError') return 'Token expired';
    if (isDatabaseUnavailableError(error)) return 'ServiceUnavailable';
    return 'Invalid token';
};

module.exports = { socketAuthErrorMessage };
