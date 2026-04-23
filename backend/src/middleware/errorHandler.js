const logger = require('../utils/logger');

/**
 * Catches any unhandled errors thrown in route handlers.
 * Logs full error server-side; returns generic message to client.
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });

  if (res.headersSent) return next(err);

  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
    },
  });
};

/**
 * 404 handler — must be registered after all routes.
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};

module.exports = { errorHandler, notFoundHandler };
