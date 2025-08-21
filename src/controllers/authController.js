const authService = require('../services/authService');
const ApiResponse = require('../utils/responses');
const logger = require('../utils/logger');

class AuthController {
    /**
     * Google Sign Up - for new users
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async googleSignUp(req, res) {
        try {
            const { idToken } = req.body;

            const result = await authService.googleSignUp(idToken);

            return ApiResponse.success(res, result, 'Sign up successful');
        } catch (error) {
            logger.error('Error in googleSignUp controller:', error);

            const statusCode = authService.getErrorStatusCode(error.code);
            const message = authService.getErrorMessage(error.code);

            return ApiResponse.error(res, message, statusCode);
        }
    }

    /**
     * Google Sign In - for existing users
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async googleSignIn(req, res) {
        try {
            const { idToken } = req.body;

            const result = await authService.googleSignIn(idToken);

            return ApiResponse.success(res, result, 'Sign in successful');
        } catch (error) {
            logger.error('Error in googleSignIn controller:', error);

            const statusCode = authService.getErrorStatusCode(error.code);
            const message = authService.getErrorMessage(error.code);

            return ApiResponse.error(res, message, statusCode);
        }
    }

    /**
     * Refresh expired Firebase token
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            const result = await authService.refreshToken(refreshToken);

            return ApiResponse.success(res, result, 'Token refreshed successfully');
        } catch (error) {
            logger.error('Error in refreshToken controller:', error);

            const statusCode = authService.getErrorStatusCode(error.code);
            const message = authService.getErrorMessage(error.code);

            return ApiResponse.error(res, message, statusCode);
        }
    }
}

module.exports = new AuthController();