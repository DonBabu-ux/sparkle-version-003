const logger = require('./logger');

/**
 * Answer a 500 without echoing internals to the client.
 *
 * Three response shapes are in use across the controllers, so this exposes one
 * per shape rather than sniffing at the object passed in. Each logs the error
 * object — keeping the stack, which pins the call site — and returns a fixed
 * message.
 *
 * The raw driver message is a SQL fragment, a table or column name, or the DSN.
 * Sent back to the caller it is a free description of the schema, and it is most
 * public exactly where the failure is.
 */
const GENERIC = 'Something went wrong. Please try again.';

function answer(res, err, status, shape) {
    logger.error('[api] unhandled 500:', err);
    res.status(status).json({ ...shape, error: GENERIC });
}

module.exports = {
    /** `{ error }` — social, realtime, admin, search, campus, moments. */
    serverError: (res, err, status = 500) => answer(res, err, status, {}),

    /** `{ status: 'error', error }` — messages, groupChat, groupChannels. */
    statusError: (res, err, status = 500) => answer(res, err, status, { status: 'error' }),

    /** `{ success: false, error }` — media. */
    apiError: (res, err, status = 500) => answer(res, err, status, { success: false }),
};

/**
 * Answer a 400 with the caller's reason only when it is one a user may see.
 *
 * A service that throws `new Error(message)` gives the controller no way to
 * tell a domain rejection from a database failure, so a handler that echoes
 * `error.message` on a 400 either leaks internals or hides the reason. Services
 * mark their user-facing rejections with `isOperational` (see
 * services/accountLifecycle.service.js domainError), and this responds with that
 * reason when the marker is present and the fallback when it is not.
 *
 * The status is a parameter because callers use it for both 400 and 409.
 */
function clientError(res, err, fallback, status = 400) {
    if (err && err.isOperational === true) {
        return res.status(status).json({ error: err.message });
    }
    logger.error('[api] rejected request with an unmapped error:', err);
    return res.status(status).json({ error: fallback });
}
module.exports.clientError = clientError;
