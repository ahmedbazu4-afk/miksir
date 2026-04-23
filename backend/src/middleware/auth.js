const jwt = require('jsonwebtoken');
const { unauthorized } = require('../utils/response');
const supabase = require('../utils/supabase');
const logger = require('../utils/logger');

/**
 * Verifies the JWT access token from the Authorization header.
 * Attaches req.user = { id, email } on success.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    // Verify with Supabase (handles our issued JWTs & Supabase Auth tokens)
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return unauthorized(res, 'Invalid or expired token');
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    return unauthorized(res, 'Token verification failed');
  }
};

module.exports = { authenticate };
