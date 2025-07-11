const { admin } = require('./firebase');
const logger = require('../utils/logger');

let firestoreInstance;

const initializeFirestore = () => {
    try {
        if (firestoreInstance) {
            return firestoreInstance;
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

// Initialize Firestore on module load
const db = initializeFirestore();

// Collection references
const collections = {
    documents: db.collection('documents'),
    users: db.collection('users'),
    companies: db.collection('companies')
};

module.exports = {
    db,
    collections,
    admin
};