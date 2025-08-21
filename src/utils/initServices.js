const logger = require('./logger');

// Service initialization status (shared with app.js)
global.servicesReady = {
    firebase: false,
    mongodb: false,
    redis: false
};

const initializeServices = async () => {
    logger.info('Initializing services...');

    // Initialize Firebase
    try {
        require('../config/firebase');
        global.servicesReady.firebase = true;
        logger.info('Firebase initialization completed');
    } catch (error) {
        logger.error('Firebase initialization failed:', error);
        global.servicesReady.firebase = false;
    }

    // Initialize MongoDB connection
    try {
        const mongodb = require('../config/mongodb');
        await mongodb.connect();
        global.servicesReady.mongodb = true;
        logger.info('MongoDB connected successfully');

        // Initialize user service indexes
        const userService = require('../services/userService');
        await userService.initializeIndexes();
        logger.info('User service indexes initialized');
    } catch (error) {
        logger.error('MongoDB connection failed:', error);
        global.servicesReady.mongodb = false;
    }

    // Initialize Redis connection
    try {
        const redis = require('../config/redis');
        await redis.connect();
        global.servicesReady.redis = true;
        logger.info('Redis connected successfully');
    } catch (error) {
        logger.error('Redis connection failed:', error);
        global.servicesReady.redis = false;
    }

    logger.info('Service initialization completed:', global.servicesReady);
};

module.exports = initializeServices;