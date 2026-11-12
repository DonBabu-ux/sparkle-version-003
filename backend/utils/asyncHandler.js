'use strict';

/**
 * utils/asyncHandler.js
 *
 * Express 4.22 does NOT forward a rejected promise from an async handler to
 * the error middleware. A handler that throws outside its try/catch therefore
 * produces no response at all — the client hangs until its own timeout — and,
 * since server.js now exits on unhandledRejection, one such request used to
 * cost the entire instance.
 *
 * Wrapping a handler passes the rejection to next(), so it reaches the real
 * error middleware: one 500, one clear response, process alive.
 *
 *   router.get('/x', asyncHandler(async (req, res) => { ... }));
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
