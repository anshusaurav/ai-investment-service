const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp;

const initializeFirebase = () => {
    try {
        if (firebaseApp) {
            return firebaseApp;
        }

        // Check if Firebase is already initialized
        if (admin.apps.length > 0) {
            firebaseApp = admin.apps[0];
            logger.info('Using existing Firebase app instance');
            return firebaseApp;
        }

        let credential;

        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            try {
                // Using service account key from environment variable (recommended for production)
                const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
                const serviceAccount = JSON.parse(serviceAccountString);

                // Validate required fields
                if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
                    throw new Error('Invalid service account key: missing required fields');
                }

                credential = admin.credential.cert(serviceAccount);
                logger.info('Firebase initialized with service account from environment variable');
            } catch (parseError) {
                logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError.message);
                throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format');
            }
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            // Using Google Application Default Credentials
            credential = admin.credential.applicationDefault();
            logger.info('Firebase initialized with Application Default Credentials');
        } else {
            // Using service account key file (for development)
            try {
                credential = admin.credential.cert(require('../../serviceAccountKey.json'));
                logger.info('Firebase initialized with service account key file');
            } catch (error) {
                logger.error('Service account key file not found. Please provide Firebase credentials.');
                throw new Error('Firebase credentials not found');
            }
        }

        // Validate project ID
        if (!process.env.FIREBASE_PROJECT_ID) {
            throw new Error('FIREBASE_PROJECT_ID environment variable is required');
        }

        firebaseApp = admin.initializeApp({
            credential,
            projectId: process.env.FIREBASE_PROJECT_ID
        });

        logger.info(`Firebase Admin SDK initialized successfully for project: ${process.env.FIREBASE_PROJECT_ID}`);

        // Test the connection
        const db = admin.firestore();
        logger.info('Firestore connection established');

        return firebaseApp;
    } catch (error) {
        logger.error('Failed to initialize Firebase:', error);
        throw error;
    }
};

// Initialize Firebase on module load
initializeFirebase();

module.exports = {
    admin,
    firebaseApp: () => firebaseApp
};