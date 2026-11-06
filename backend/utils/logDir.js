'use strict';

/**
 * Where runtime logs live.
 *
 * The dev script starts the server with `node --watch --watch-path=.` from
 * inside backend/, so the watcher covers this entire directory and restarts the
 * process on anything written under it. Both the 60s crash heartbeat and
 * winston's file transports wrote into backend/.logs, so a running dev server
 * used to kill and restart itself about once a minute — observed as 97% of
 * processes living 55-85s with a median of exactly 60s, the heartbeat interval.
 *
 * Node exposes no --watch-ignore flag (only --watch, --watch-path,
 * --watch-kill-signal and --watch-preserve-output) and its built-in ignores are
 * limited to node_modules and .git, so the logs have to move instead.
 *
 * Production keeps backend/.logs exactly as before. Set SPARKLE_LOG_DIR to
 * override the location everywhere.
 */
const os = require('os');
const path = require('path');

const isServerless = !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.FUNCTION_NAME ||
    process.env.NOW_REGION
);

function resolveLogDir() {
    if (process.env.SPARKLE_LOG_DIR) {
        return path.resolve(process.env.SPARKLE_LOG_DIR);
    }
    if (isServerless) {
        return '/tmp/logs';
    }
    if (process.env.NODE_ENV === 'production') {
        return path.join(__dirname, '..', '.logs');
    }
    // Development: outside the watched tree, so writing a log cannot restart us.
    return path.join(os.tmpdir(), 'sparkle-logs');
}

module.exports = { resolveLogDir, isServerless };
