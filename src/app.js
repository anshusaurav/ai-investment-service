const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
// const cors = require('cors');
require('dotenv').config();

// Import middleware
const corsMiddleware = require('./middleware/cors');
const generalLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const routes = require('./routes');

// Import logger
const logger = require('./utils/logger');

// Initialize Firebase
require('./config/firebase');

// Initialize MongoDB connection
const mongodb = require('./config/mongodb');
mongodb.connect().catch(err => {
    logger.error('Failed to connect to MongoDB on startup:', err);
});

const app = express();

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
// app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
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