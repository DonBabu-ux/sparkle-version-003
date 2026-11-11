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
