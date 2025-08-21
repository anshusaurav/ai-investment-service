const userService = require('../services/userService');
const watchlistService = require('../services/watchlistService');
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
            const userId = req.user.uid;

            // Get user profile from MongoDB
            const userProfile = await userService.getUserByUid(userId);

            if (!userProfile) {
                return ApiResponse.error(res, 'User profile not found', 404);
            }

            // Remove sensitive information
            const { _id, ...safeProfile } = userProfile;

            return ApiResponse.success(res, safeProfile, 'User profile retrieved successfully');
        } catch (error) {
            logger.error('Error in getUserProfile controller:', error);
            return ApiResponse.error(res, 'Failed to retrieve user profile', 500);
        }
    }

    /**
     * Update user profile
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async updateUserProfile(req, res) {
        try {
            const userId = req.user.uid;
            const updates = req.body;

            if (!updates || Object.keys(updates).length === 0) {
                return ApiResponse.validationError(res, ['Updates are required']);
            }

            // Update user profile
            const updatedProfile = await userService.updateUserProfile(userId, updates);

            if (!updatedProfile) {
                return ApiResponse.error(res, 'User not found', 404);
            }

            // Remove sensitive information
            const { _id, ...safeProfile } = updatedProfile;

            return ApiResponse.success(res, safeProfile, 'User profile updated successfully');
        } catch (error) {
            logger.error('Error in updateUserProfile controller:', error);
            return ApiResponse.error(res, 'Failed to update user profile', 500);
        }
    }

    /**
     * Get user's watchlist
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getWatchlist(req, res) {
        try {
            const userId = req.user.uid;
            const watchlist = await watchlistService.getUserWatchlist(userId);

            return ApiResponse.success(
                res,
                { watchlist },
                "Watchlist retrieved successfully"
            );
        } catch (error) {
            logger.error("Error in getWatchlist controller:", error);
            return ApiResponse.error(res, "Failed to retrieve watchlist", 500);
        }
    }

    /**
     * Add company to watchlist
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async addToWatchlist(req, res) {
        try {
            const userId = req.user.uid;
            const { companyCode } = req.body;

            if (!companyCode) {
                return ApiResponse.validationError(res, ['Company code is required']);
            }

            const result = await watchlistService.followCompany(userId, companyCode);

            return ApiResponse.success(res, result, 'Company added to watchlist successfully');
        } catch (error) {
            logger.error('Error in addToWatchlist controller:', error);
            return ApiResponse.error(res, 'Failed to add company to watchlist', 500);
        }
    }

    /**
     * Remove company from watchlist
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async removeFromWatchlist(req, res) {
        try {
            const userId = req.user.uid;
            const { companyCode } = req.body;

            if (!companyCode) {
                return ApiResponse.validationError(res, ['Company code is required']);
            }

            const result = await watchlistService.unfollowCompany(userId, companyCode);

            return ApiResponse.success(res, result, 'Company removed from watchlist successfully');
        } catch (error) {
            logger.error('Error in removeFromWatchlist controller:', error);
            return ApiResponse.error(res, 'Failed to remove company from watchlist', 500);
        }
    }
}

module.exports = new UserController();