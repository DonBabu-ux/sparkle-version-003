// middleware/timeout.middleware.js
// Request timeout protection — kills hanging requests before they pile up
// Prevents event loop saturation under heavy load

/**
 * @param {number} ms - Timeout in milliseconds (default 15s for API, use 60s for upload routes)
 */
const requestTimeout = (ms = 15000) => (req, res, next) => {
    const timer = setTimeout(() => {
        if (!res.headersSent) {
            res.status(503).json({
                status: 'error',
                message: 'Request timed out. Server is under heavy load, please retry.'
            });
        }
    }, ms);

    // Clear timer once response is finished (success or error)
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
};

module.exports = { requestTimeout };
