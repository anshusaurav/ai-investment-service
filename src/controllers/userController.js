const userService = require('../services/userService');
const authService = require('../services/authService');
const ApiResponse = require('../utils/responses');
const logger = require('../utils/logger');

class UserController {
    /**
     * Get user profile
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getUserProfile(req, res) {
        try {
            const { idToken } = req.body;

            // Verify token first
            const userData = await authService.verifyIdToken(idToken);

            // Get detailed user profile
            const userProfile = await userService.getUserProfile(userData.uid);

            return ApiResponse.success(res, userProfile, 'User profile retrieved successfully');
        } catch (error) {
            logger.error('Error in getUserProfile controller:', error);

            const statusCode = authService.getErrorStatusCode(error.code);
            const message = authService.getErrorMessage(error.code);

            return ApiResponse.error(res, message, statusCode);
        }
    }

    /**
     * Update user profile
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async updateUserProfile(req, res) {
        try {
            const { idToken, updates } = req.body;

            if (!updates || Object.keys(updates).length === 0) {
                return ApiResponse.validationError(res, ['Updates are required']);
            }

            // Verify token first
            const userData = await authService.verifyIdToken(idToken);

            // Update user profile
            const updatedProfile = await userService.updateUserProfile(userData.uid, updates);

            return ApiResponse.success(res, updatedProfile, 'User profile updated successfully');
        } catch (error) {
            logger.error('Error in updateUserProfile controller:', error);

            const statusCode = authService.getErrorStatusCode(error.code);
            const message = authService.getErrorMessage(error.code);

            return ApiResponse.error(res, message, statusCode);
        }
    }

    /**
     * Set custom claims for user
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async setCustomClaims(req, res) {
        try {
            const { uid, customClaims } = req.body;

            if (!uid) {
                return ApiResponse.validationError(res, ['User ID is required']);
            }

            if (!customClaims || typeof customClaims !== 'object') {
                return ApiResponse.validationError(res, ['Custom claims must be an object']);
            }

            await userService.setCustomClaims(uid, customClaims);

            return ApiResponse.success(res, null, 'Custom claims set successfully');
        } catch (error) {
            logger.error('Error in setCustomClaims controller:', error);
            return ApiResponse.error(res, 'Failed to set custom claims', 500);
        }
    }

    /**
     * Disable user account
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async disableUser(req, res) {
        try {
            const { uid } = req.body;

            if (!uid) {
                return ApiResponse.validationError(res, ['User ID is required']);
            }

            await userService.disableUser(uid);

            return ApiResponse.success(res, null, 'User account disabled successfully');
        } catch (error) {
            logger.error('Error in disableUser controller:', error);
            return ApiResponse.error(res, 'Failed to disable user account', 500);
        }
    }

    /**
     * Enable user account
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async enableUser(req, res) {
        try {
            const { uid } = req.body;

            if (!uid) {
                return ApiResponse.validationError(res, ['User ID is required']);
            }

            await userService.enableUser(uid);

            return ApiResponse.success(res, null, 'User account enabled successfully');
        } catch (error) {
            logger.error('Error in enableUser controller:', error);
            return ApiResponse.error(res, 'Failed to enable user account', 500);
        }
    }
}

module.exports = new UserController();