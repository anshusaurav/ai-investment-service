const logger = require('./logger');

class ApiResponse {
    static success(res, data, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    static error(res, message = 'Internal Server Error', statusCode = 500, details = null) {
        logger.error(`API Error: ${message}`, { statusCode, details });

        const response = {
            success: false,
            message,
            timestamp: new Date().toISOString()
        };

        if (details && process.env.NODE_ENV !== 'production') {
            response.details = details;
        }

        return res.status(statusCode).json(response);
    }

    static validationError(res, errors) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors,
            timestamp: new Date().toISOString()
        });
    }

    static unauthorized(res, message = 'Unauthorized') {
        return res.status(401).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }

    static forbidden(res, message = 'Forbidden') {
        return res.status(403).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }

    static notFound(res, message = 'Resource not found') {
        return res.status(404).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }

    static tooManyRequests(res, message = 'Too many requests') {
        return res.status(429).json({
            success: false,
            message,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = ApiResponse;