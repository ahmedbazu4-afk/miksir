/**
 * Consistent JSON response helpers used across all routes.
 */

const success = (res, data = {}, message = 'Success', status = 200) =>
  res.status(status).json({ success: true, data, message });

const created = (res, data = {}, message = 'Created') =>
  success(res, data, message, 201);

const error = (res, message = 'An error occurred', code = 'ERROR', details = null, status = 400) => {
  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  return res.status(status).json(body);
};

const serverError = (res, message = 'Internal server error') =>
  error(res, message, 'SERVER_ERROR', null, 500);

const notFound = (res, resource = 'Resource') =>
  error(res, `${resource} not found`, 'NOT_FOUND', null, 404);

const unauthorized = (res, message = 'Unauthorized') =>
  error(res, message, 'UNAUTHORIZED', null, 401);

const forbidden = (res, message = 'Forbidden') =>
  error(res, message, 'FORBIDDEN', null, 403);

const conflict = (res, message) =>
  error(res, message, 'CONFLICT', null, 409);

const validationError = (res, details) =>
  error(res, 'Validation failed', 'VALIDATION_ERROR', details, 400);

module.exports = { success, created, error, serverError, notFound, unauthorized, forbidden, conflict, validationError };
