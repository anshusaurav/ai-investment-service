const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
// const cors = require('cors');
require('dotenv').config();

// Import middleware
const corsMiddleware = require('./middleware/cors');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const routes = require('./routes');

// Import logger
const logger = require('./utils/logger');

// Service initialization status (will be set by server.js)
const getServicesReady = () => global.servicesReady || { firebase: false, mongodb: false };

const app = express();

// Trust proxy - required for Cloud Run and other reverse proxies
// This enables Express to trust the X-Forwarded-* headers
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true);
    logger.info('Express configured to trust proxy headers');
} else {
    // For development, trust localhost proxies
    app.set('trust proxy', 'loopback');
}

// Security middleware
app.use(helmet());
app.use(compression());

// Logging middleware
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware
app.use(corsMiddleware);

// Rate limiting middleware
app.use(generalLimiter);

// Health check endpoint - always responds OK for Cloud Run
app.get('/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: getServicesReady()
    };

    res.status(200).json(health);
});

// Readiness check endpoint - shows service status
app.get('/ready', (req, res) => {
    const services = getServicesReady();
    const allReady = services.firebase && services.mongodb;
    res.status(allReady ? 200 : 503).json({
        ready: allReady,
        services: services,
        timestamp: new Date().toISOString()
    });
});

// Debug endpoint to check CORS configuration
app.get('/debug/cors', (req, res) => {
    res.json({
        origin: req.get('Origin'),
        allowedOrigins: process.env.ALLOWED_ORIGINS,
        nodeEnv: process.env.NODE_ENV,
        headers: req.headers
    });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;