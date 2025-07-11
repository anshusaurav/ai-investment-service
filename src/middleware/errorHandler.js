const logger = require('../utils/logger');

const errorHandler = (error, req, res, next) => {
    logger.error('Error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Default error response
    let statusCode = 500;
    let message = 'Internal Server Error';

    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
    } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (error.name === 'ForbiddenError') {
        statusCode = 403;
        message = 'Forbidden';
    } else if (error.name === 'NotFoundError') {
        statusCode = 404;
        message = 'Not Found';
    } else if (error.message === 'Not allowed by CORS') {
        statusCode = 403;
        message = 'CORS Error: Origin not allowed';
    } else if (error.type === 'entity.parse.failed') {
        statusCode = 400;
        message = 'Invalid JSON format';
    } else if (error.type === 'entity.too.large') {
        statusCode = 413;
        message = 'Request entity too large';
    }

    // Don't expose internal error details in production
    const response = {
        success: false,
        message,
        timestamp: new Date().toISOString()
    };

    if (process.env.NODE_ENV !== 'production') {
        response.stack = error.stack;
    }

    res.status(statusCode).json(response);
};

module.exports = errorHandler;