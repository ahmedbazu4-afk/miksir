require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ─── Route modules ────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/users');
const chatRoutes      = require('./routes/chats');
const designRoutes    = require('./routes/designs');
const standardRoutes  = require('./routes/standards');
const shareRoutes = require('./routes/share');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ─────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-JSON-Response-Size'],
  optionsSuccessStatus: 200,
  maxAge: 86400 // Cache preflight for 24 hours
};

// Apply CORS globally
app.use(cors(corsOptions));

// Explicit preflight handler for all routes
app.options('*', cors(corsOptions));

// ─── Body parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── HTTP request logging ─────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ─── Rate limiting ────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900_000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
});

// Stricter limiter for auth endpoints (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts. Try again in 15 minutes.' } },
});

app.use(globalLimiter);

// ─── Health check ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'miksir-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── Routes ───────────────────────────────────────────────────────
app.use('/auth',           authLimiter, authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/chats',      chatRoutes);
app.use('/api/designs',    designRoutes);
app.use('/api/standards',  standardRoutes);
app.use('/api', shareRoutes); 

// ─── 404 & error handlers (must be last) ─────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🏗️  Miksir backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  logger.info(`📐  Allowed origins: ${allowedOrigins.join(', ')}`);
});

module.exports = app;