const app = require('./src/app');
const logger = require('./src/utils/logger');
const mongodb = require('./src/config/mongodb');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Start server
const server = app.listen(PORT, HOST, () => {
    logger.info(`Server running on http://${HOST}:${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health (inside container)`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await mongodb.disconnect();
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await mongodb.disconnect();
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection:', err);
    server.close(() => {
        process.exit(1);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

module.exports = server;
