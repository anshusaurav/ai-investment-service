const authService = require('../services/authService');
const ApiResponse = require('../utils/responses');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate JWT token and verify Firebase user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return ApiResponse.unauthorized(res, 'Access token required');
        }

        // Verify Firebase ID token
        const userData = await authService.verifyIdToken(token);

        // Add user data to request object
        req.user = {
            uid: userData.uid,
            email: userData.email || '',
            name: userData.name || userData.displayName || '',
            displayName: userData.displayName || userData.name || '',
            emailVerified: userData.emailVerified || false
        };

        // Validate required user data
        if (!req.user.uid) {
            throw new Error('User ID not found in token');
        }

        logger.info(`User authenticated: ${userData.uid}`);
        next();
    } catch (error) {
        logger.error('Token authentication failed:', error);

        // Create enhanced error response with action hints
        const errorResponse = {
            error: 'Authentication failed',
            code: error.code,
            message: authService.getErrorMessage(error.code),
            timestamp: new Date().toISOString()
        };

        if (error.code === 'auth/id-token-expired') {
            errorResponse.action = 'refresh_token';
            errorResponse.message = 'Token has expired. Please refresh your token and try again.';
            return res.status(401).json(errorResponse);
        } else if (error.code === 'auth/id-token-revoked') {
            errorResponse.action = 'login_required';
            errorResponse.message = 'Token has been revoked. Please log in again.';
            return res.status(401).json(errorResponse);
        } else if (error.code === 'auth/invalid-id-token') {
            errorResponse.action = 'login_required';
            errorResponse.message = 'Invalid token format. Please log in again.';
            return res.status(400).json(errorResponse);
        } else if (error.code === 'auth/user-not-found') {
            errorResponse.action = 'signup_required';
            errorResponse.message = 'User not found. Please sign up first.';
            return res.status(404).json(errorResponse);
        } else if (error.code === 'auth/user-disabled') {
            errorResponse.action = 'contact_support';
            errorResponse.message = 'User account has been disabled. Please contact support.';
            return res.status(403).json(errorResponse);
        }

        errorResponse.action = 'login_required';
        errorResponse.message = 'Invalid or expired token. Please log in again.';
        return res.status(401).json(errorResponse);
    }
};

/**
 * Optional authentication middleware - doesn't fail if token is missing
 * Sets req.user if valid token is present, otherwise continues without user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            // No token provided, continue without authentication
            return next();
        }

        // Verify Firebase ID token
        const userData = await authService.verifyIdToken(token);

        // Add user data to request object
        req.user = {
            uid: userData.uid,
            email: userData.email || '',
            name: userData.name || userData.displayName || '',
            displayName: userData.displayName || userData.name || '',
            emailVerified: userData.emailVerified || false
        };

        logger.info(`User optionally authenticated: ${userData.uid}`);
        next();
    } catch (error) {
        // Token is invalid, but we don't fail - just continue without user
        logger.warn('Optional auth failed, continuing without authentication:', error.message);
        next();
    }
};

module.exports = {
    authenticateToken,
    optionalAuth
};