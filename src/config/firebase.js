const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp;

const initializeFirebase = () => {
    try {
        if (firebaseApp) {
            return firebaseApp;
        }

        let credential;

        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            // Using service account key from environment variable (recommended for production)
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            credential = admin.credential.cert(serviceAccount);
            logger.info('Firebase initialized with service account from environment variable');
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

        firebaseApp = admin.initializeApp({
            credential,
            projectId: process.env.FIREBASE_PROJECT_ID
        });

        logger.info(`Firebase Admin SDK initialized for project: ${process.env.FIREBASE_PROJECT_ID}`);
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