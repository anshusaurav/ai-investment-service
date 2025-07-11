const authService = require('../services/authService');
const ApiResponse = require('../utils/responses');
const logger = require('../utils/logger');

class AuthController {
    /**
     * Verify Firebase ID token
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async verifyToken(req, res) {
        try {
            const { idToken } = req.body;

            const userData = await authService.verifyIdToken(idToken);

            return ApiResponse.success(res, {
                valid: true,
                user: userData
            }, 'Token verified successfully');
        } catch (error) {
            logger.error('Error in verifyToken controller:', error);

            const statusCode = authService.getErrorStatusCode(error.code);
            const message = authService.getErrorMessage(error.code);

            return res.status(statusCode).json({
                valid: false,
                error: message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Create custom token
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async createCustomToken(req, res) {
        try {
            const { uid, additionalClaims } = req.body;

            if (!uid) {
                return ApiResponse.validationError(res, ['User ID is required']);
            }

            const customToken = await authService.createCustomToken(uid, additionalClaims);

            return ApiResponse.success(res, {
                customToken
            }, 'Custom token created successfully');
        } catch (error) {
            logger.error('Error in createCustomToken controller:', error);
            return ApiResponse.error(res, 'Failed to create custom token', 500);
        }
    }

    /**
     * Revoke refresh tokens
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async revokeTokens(req, res) {
        try {
            const { uid } = req.body;

            if (!uid) {
                return ApiResponse.validationError(res, ['User ID is required']);
            }

            await authService.revokeRefreshTokens(uid);

            return ApiResponse.success(res, null, 'Refresh tokens revoked successfully');
        } catch (error) {
            logger.error('Error in revokeTokens controller:', error);
            return ApiResponse.error(res, 'Failed to revoke tokens', 500);
        }
    }
}

module.exports = new AuthController();