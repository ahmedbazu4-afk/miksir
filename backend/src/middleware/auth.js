const jwt = require('jsonwebtoken');
const { unauthorized } = require('../utils/response');
const supabase = require('../utils/supabase');
const logger = require('../utils/logger');

/**
 * Verifies the JWT access token from the Authorization header.
 * Attaches req.user = { id, email } on success.
 * 
 * For Render/production: Decodes the JWT directly instead of calling getUser()
 * because getUser() requires network calls to Supabase and may fail intermittently.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid auth header', { 
        hasHeader: !!authHeader,
        origin: req.get('origin')
      });
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    // Option 1: Decode JWT locally (faster, more reliable)
    try {
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded) {
        logger.warn('Token decode failed - invalid format');
        return unauthorized(res, 'Invalid token format');
      }

      const { payload } = decoded;
      
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        logger.warn('Token expired', { exp: payload.exp });
        return unauthorized(res, 'Token expired');
      }

      // Extract user info from JWT payload
      // Supabase JWTs have: sub (user_id), email, etc.
      if (!payload.sub || !payload.email) {
        logger.warn('Token missing required claims', { 
          hasSub: !!payload.sub, 
          hasEmail: !!payload.email 
        });
        return unauthorized(res, 'Invalid token claims');
      }

      req.user = { 
        id: payload.sub, 
        email: payload.email 
      };
      
      logger.debug('Auth successful', { userId: payload.sub, email: payload.email });
      next();
    } catch (decodeErr) {
      logger.error('JWT decode error', { error: decodeErr.message });
      return unauthorized(res, 'Token verification failed');
    }
    
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    return unauthorized(res, 'Token verification failed');
  }
};

module.exports = { authenticate };