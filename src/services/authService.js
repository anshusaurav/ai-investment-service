const { admin } = require('../config/firebase');
const userService = require('./userService');
const logger = require('../utils/logger');

class AuthService {
    /**
     * Google Sign Up - for new users
     * @param {string} idToken - Firebase ID token from Google
     * @returns {Promise<Object>} User data
     */
    async googleSignUp(idToken) {
        try {
            // Verify the token first
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            // Check if user already exists in MongoDB
            const existingMongoUser = await userService.userExists(decodedToken.uid);
            if (existingMongoUser) {
                const error = new Error('User already exists. Please sign in instead.');
                error.code = 'auth/user-already-exists';
                throw error;
            }

            // Check if user already exists in Firebase Auth
            try {
                const existingFirebaseUser = await admin.auth().getUser(decodedToken.uid);
                if (existingFirebaseUser) {
                    // User exists in Firebase but not in MongoDB, this shouldn't happen in normal flow
                    logger.warn(`User exists in Firebase but not in MongoDB: ${decodedToken.uid}`);
                }
            } catch (error) {
                // If user doesn't exist in Firebase, that's fine for signup
                if (error.code !== 'auth/user-not-found') {
                    throw error;
                }
            }

            // For new users, we can get the user record (it should exist after Google auth)
            const userRecord = await admin.auth().getUser(decodedToken.uid);

            // Ensure the user signed up with Google
            if (!userRecord.providerData.some(provider => provider.providerId === 'google.com')) {
                const error = new Error('Only Google authentication is allowed');
                error.code = 'auth/invalid-provider';
                throw error;
            }

            // Set custom claims for new user
            await admin.auth().setCustomUserClaims(decodedToken.uid, {
                signupMethod: 'google',
                signupDate: new Date().toISOString()
            });

            // Create user in MongoDB
            const userData = {
                uid: decodedToken.uid,
                email: decodedToken.email,
                name: decodedToken.name,
                picture: decodedToken.picture,
                emailVerified: decodedToken.email_verified,
                provider: 'google.com'
            };

            const mongoUser = await userService.createUser(userData);

            logger.info(`Google sign up successful for user: ${decodedToken.uid}`);

            return {
                uid: decodedToken.uid,
                email: decodedToken.email,
                name: decodedToken.name,
                picture: decodedToken.picture,
                emailVerified: decodedToken.email_verified,
                isNewUser: true,
                provider: 'google.com',
                mongoUser: {
                    _id: mongoUser._id,
                    createdAt: mongoUser.createdAt
                }

            };
        } catch (error) {
            logger.error('Google sign up failed:', {
                error: error.message,
                code: error.code
            });
            throw error;
        }
    }

    /**
     * Google Sign In - for existing users
     * @param {string} idToken - Firebase ID token from Google
     * @returns {Promise<Object>} User data
     */
    async googleSignIn(idToken) {
        try {
            // Verify the token first
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            // Check if user exists in Firebase Auth
            const userRecord = await admin.auth().getUser(decodedToken.uid);

            if (!userRecord) {
                const error = new Error('User not found. Please sign up first.');
                error.code = 'auth/user-not-found';
                throw error;
            }

            // Ensure the user signed in with Google
            if (!userRecord.providerData.some(provider => provider.providerId === 'google.com')) {
                const error = new Error('Only Google authentication is allowed');
                error.code = 'auth/invalid-provider';
                throw error;
            }

            // Check if user exists in MongoDB
            const mongoUser = await userService.getUserByUid(decodedToken.uid);
            if (!mongoUser) {
                const error = new Error('User not found in database. Please sign up first.');
                error.code = 'auth/user-not-found';
                throw error;
            }

            // Update last login time
            await userService.updateLastLogin(decodedToken.uid);

            logger.info(`Google sign in successful for user: ${decodedToken.uid}`);

            return {
                uid: decodedToken.uid,
                email: decodedToken.email,
                name: decodedToken.name,
                picture: decodedToken.picture,
                emailVerified: decodedToken.email_verified,
                isNewUser: false,
                provider: 'google.com',
                mongoUser: {
                    _id: mongoUser._id,
                    lastLoginAt: new Date(),
                    watchlist: mongoUser.watchlist || []
                }
            };
        } catch (error) {
            logger.error('Google sign in failed:', {
                error: error.message,
                code: error.code
            });
            throw error;
        }
    }

    /**
     * Refresh expired Firebase token
     * @param {string} refreshToken - Firebase refresh token
     * @returns {Promise<Object>} New token data
     */
    async refreshToken(refreshToken) {
        try {
            // Check if Firebase API key is configured
            if (!process.env.FIREBASE_API_KEY) {
                const error = new Error('Firebase API key not configured');
                error.code = 'auth/configuration-error';
                throw error;
            }

            // Use Firebase Auth REST API to refresh token
            const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || 'Failed to refresh token');
                
                // Map Firebase REST API errors to our error codes
                if (response.status === 400) {
                    error.code = 'auth/invalid-refresh-token';
                } else if (response.status === 403) {
                    error.code = 'auth/forbidden';
                } else {
                    error.code = 'auth/refresh-failed';
                }
                
                throw error;
            }

            const data = await response.json();
            
            // Verify the new ID token to get user data
            const decodedToken = await admin.auth().verifyIdToken(data.id_token);

            logger.info(`Token refreshed successfully for user: ${decodedToken.uid}`);

            return {
                idToken: data.id_token,
                refreshToken: data.refresh_token,
                expiresIn: data.expires_in,
                user: {
                    uid: decodedToken.uid,
                    email: decodedToken.email,
                    name: decodedToken.name,
                    picture: decodedToken.picture,
                    emailVerified: decodedToken.email_verified
                }
            };
        } catch (error) {
            logger.error('Token refresh failed:', {
                error: error.message,
                code: error.code,
                refreshTokenProvided: !!refreshToken
            });
            throw error;
        }
    }

    /**
     * Verify Firebase ID token (used by auth middleware)
     * @param {string} idToken - Firebase ID token
     * @returns {Promise<Object>} Decoded token data
     */
    async verifyIdToken(idToken) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            logger.info(`Token verified successfully for user: ${decodedToken.uid}`);

            return {
                uid: decodedToken.uid,
                email: decodedToken.email,
                name: decodedToken.name,
                displayName: decodedToken.name,
                picture: decodedToken.picture,
                emailVerified: decodedToken.email_verified,
                authTime: decodedToken.auth_time,
                exp: decodedToken.exp,
                iat: decodedToken.iat,
                firebase: decodedToken.firebase
            };
        } catch (error) {
            logger.error('Token verification failed:', {
                error: error.message,
                code: error.code
            });
            throw error;
        }
    }

    /**
     * Get error message based on Firebase error code
     * @param {string} errorCode - Firebase error code
     * @returns {string} User-friendly error message
     */
    getErrorMessage(errorCode) {
        const errorMessages = {
            'auth/id-token-expired': 'Token has expired',
            'auth/id-token-revoked': 'Token has been revoked',
            'auth/invalid-id-token': 'Invalid token format',
            'auth/invalid-refresh-token': 'Invalid or expired refresh token',
            'auth/refresh-failed': 'Failed to refresh token',
            'auth/configuration-error': 'Server configuration error',
            'auth/forbidden': 'Access forbidden',
            'auth/user-not-found': 'User not found. Please sign up first.',
            'auth/user-already-exists': 'User already exists. Please sign in instead.',
            'auth/user-disabled': 'User account has been disabled',
            'auth/project-not-found': 'Firebase project not found',
            'auth/insufficient-permission': 'Insufficient permissions',
            'auth/invalid-provider': 'Only Google authentication is allowed'
        };

        return errorMessages[errorCode] || 'Authentication failed';
    }

    /**
     * Get HTTP status code based on Firebase error code
     * @param {string} errorCode - Firebase error code
     * @returns {number} HTTP status code
     */
    getErrorStatusCode(errorCode) {
        const statusCodes = {
            'auth/id-token-expired': 401,
            'auth/id-token-revoked': 401,
            'auth/invalid-id-token': 400,
            'auth/invalid-refresh-token': 401,
            'auth/refresh-failed': 401,
            'auth/configuration-error': 500,
            'auth/forbidden': 403,
            'auth/user-not-found': 404,
            'auth/user-already-exists': 409,
            'auth/user-disabled': 403,
            'auth/project-not-found': 500,
            'auth/insufficient-permission': 403,
            'auth/invalid-provider': 400
        };

        return statusCodes[errorCode] || 401;
    }
}

module.exports = new AuthService();