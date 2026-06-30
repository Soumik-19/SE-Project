/**
 * middleware/error.js
 * ───────────────────
 * Global Express error handler.
 * Catches any error passed to next(err) across all routes.
 * Returns a consistent JSON error envelope.
 *
 * PLACEMENT: backend/middleware/error.js
 * MOUNTED IN: backend/server.js (after all routes, as last middleware)
 */

export function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error.';

  // Log in development; suppress stack in production
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);
  }

  res.status(status).json({
    error:   true,
    message: message,
    code:    status,
  });
}

// Helper: create an HTTP error with a status code attached
export function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
