const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Custom key generator that works with proxy headers
const keyGenerator = (req) => {
    // In production behind a proxy, use the real IP from X-Forwarded-For
    // Express will handle this correctly when trust proxy is enabled
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    logger.debug(`Rate limiter using IP: ${ip} for request from ${req.get('X-Forwarded-For') || 'direct'}`);
    return ip;
};

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // configurable limit
    keyGenerator,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
    },
    handler: (req, res) => {
        const ip = req.ip || 'unknown';
        logger.warn(`Rate limit exceeded for IP: ${ip}, User-Agent: ${req.get('User-Agent')}`);
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        });
    }
});

// Stricter rate limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 50, // configurable auth limit
    keyGenerator,
    message: {
        error: 'Too many authentication requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const ip = req.ip || 'unknown';
        logger.warn(`Auth rate limit exceeded for IP: ${ip}, User-Agent: ${req.get('User-Agent')}`);
        res.status(429).json({
            error: 'Too many authentication requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        });
    }
});

module.exports = {
    generalLimiter,
    authLimiter
};