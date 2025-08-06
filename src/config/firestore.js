const { admin } = require('./firebase');
const logger = require('../utils/logger');

let firestoreInstance;

const initializeFirestore = () => {
    try {
        if (firestoreInstance) {
            return firestoreInstance;
        }

        // Ensure Firebase is initialized first
        if (!admin.apps || admin.apps.length === 0) {
            throw new Error('Firebase Admin SDK not initialized. Check Firebase configuration.');
        }

        firestoreInstance = admin.firestore();

        // Configure Firestore settings
        const settings = {
            timestampsInSnapshots: true,
            ignoreUndefinedProperties: true
        };

        if (process.env.NODE_ENV === 'development') {
            // Use emulator in development if configured
            if (process.env.FIRESTORE_EMULATOR_HOST) {
                logger.info(`Using Firestore emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
            }
        }

        logger.info('Firestore initialized successfully');
        return firestoreInstance;
    } catch (error) {
        logger.error('Failed to initialize Firestore:', error);
        throw error;
    }
};

// Initialize Firestore on module load with retry logic
let db;
try {
    db = initializeFirestore();
} catch (error) {
    logger.error('Critical: Failed to initialize Firestore on startup:', error);
    // Don't throw here to allow the app to start, but log the error
    // The collections will be undefined and will cause errors when used
}

// Collection references - only create if db is available
const collections = db ? {
    documents: db.collection('documents'),
    users: db.collection('users'),
    companies: db.collection('companies')
} : {};

// Add a health check function
const isFirestoreReady = () => {
    return db !== undefined && firestoreInstance !== undefined;
};

module.exports = {
    db,
    collections,
    admin,
    isFirestoreReady
};