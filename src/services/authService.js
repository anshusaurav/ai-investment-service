const { admin } = require('../config/firebase');
const logger = require('../utils/logger');

class AuthService {
    /**
     * Verify Firebase ID token
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
        console.log(errorCode);
        const errorMessages = {
            'auth/id-token-expired': 'Token has expired',
            'auth/id-token-revoked': 'Token has been revoked',
            'auth/invalid-id-token': 'Invalid token format',
            'auth/user-not-found': 'User not found',
            'auth/user-disabled': 'User account has been disabled',
            'auth/project-not-found': 'Firebase project not found',
            'auth/insufficient-permission': 'Insufficient permissions'
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
            'auth/user-not-found': 404,
            'auth/user-disabled': 403,
            'auth/project-not-found': 500,
            'auth/insufficient-permission': 403
        };

        return statusCodes[errorCode] || 401;
    }

    /**
     * Create custom token for user
     * @param {string} uid - User ID
     * @param {Object} additionalClaims - Additional claims to include
     * @returns {Promise<string>} Custom token
     */
    async createCustomToken(uid, additionalClaims = {}) {
        try {
            const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
            logger.info(`Custom token created for user: ${uid}`);
            return customToken;
        } catch (error) {
            logger.error('Custom token creation failed:', {
                error: error.message,
                uid
            });
            throw error;
        }
    }

    /**
     * Revoke refresh tokens for user
     * @param {string} uid - User ID
     * @returns {Promise<void>}
     */
    async revokeRefreshTokens(uid) {
        try {
            await admin.auth().revokeRefreshTokens(uid);
            logger.info(`Refresh tokens revoked for user: ${uid}`);
        } catch (error) {
            logger.error('Failed to revoke refresh tokens:', {
                error: error.message,
                uid
            });
            throw error;
        }
    }
}

module.exports = new AuthService();