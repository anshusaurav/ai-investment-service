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

    // Initialize services after server is listening
    setTimeout(() => {
        logger.info('Starting service initialization...');
        // Import and call the initialization function
        const initServices = require('./src/utils/initServices');
        initServices();
    }, 1000); // Give server 1 second to fully start
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await mongodb.disconnect();

    try {
        const redis = require('./src/config/redis');
        await redis.disconnect();
    } catch (error) {
        logger.error('Error disconnecting Redis:', error);
    }

    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await mongodb.disconnect();

    try {
        const redis = require('./src/config/redis');
        await redis.disconnect();
    } catch (error) {
        logger.error('Error disconnecting Redis:', error);
    }

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
