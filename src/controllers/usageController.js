const usageService = require('../services/usageService');
const userService = require('../services/userService');
const ApiResponse = require('../utils/responses');
const logger = require('../utils/logger');

class UsageController {
    /**
     * GET /api/user/usage
     * Returns the current month's usage counts for the authenticated user.
     */
    async getUsage(req, res) {
        try {
            const userId = req.user.uid;
            const usage = await usageService.getUsage(userId);
            return ApiResponse.success(res, usage, 'Usage retrieved');
        } catch (error) {
            logger.error('Error in getUsage controller:', error);
            return ApiResponse.error(res, 'Failed to retrieve usage', 500);
        }
    }

    /**
     * POST /api/user/usage/guidance
     * Body: { companyCode: string }
     * Tracks that the user viewed this company's guidance tracker.
     */
    async trackGuidance(req, res) {
        try {
            const userId = req.user.uid;
            const { companyCode } = req.body;

            const isPremium = await userService.isPremium(userId);
            const result = await usageService.trackGuidanceView(userId, companyCode, isPremium);

            return ApiResponse.success(res, result, 'Guidance view tracked');
        } catch (error) {
            if (error.code === 'USAGE_LIMIT_REACHED') {
                return ApiResponse.forbidden(res, error.message);
            }
            logger.error('Error in trackGuidance controller:', error);
            return ApiResponse.error(res, 'Failed to track guidance view', 500);
        }
    }

    /**
     * POST /api/user/usage/concall
     * Body: { concallId: string }
     * Tracks that the user viewed a concall summary.
     */
    async trackConcall(req, res) {
        try {
            const userId = req.user.uid;
            const { concallId } = req.body;

            const isPremium = await userService.isPremium(userId);
            const result = await usageService.trackConcallView(userId, concallId, isPremium);

            return ApiResponse.success(res, result, 'Concall view tracked');
        } catch (error) {
            if (error.code === 'USAGE_LIMIT_REACHED') {
                return ApiResponse.forbidden(res, error.message);
            }
            logger.error('Error in trackConcall controller:', error);
            return ApiResponse.error(res, 'Failed to track concall view', 500);
        }
    }

    /**
     * DELETE /api/user/usage
     * Resets the current month's usage to zero (testing / admin).
     */
    async resetUsage(req, res) {
        try {
            const userId = req.user.uid;
            const result = await usageService.resetUsage(userId);
            return ApiResponse.success(res, result, 'Usage reset successfully');
        } catch (error) {
            logger.error('Error in resetUsage controller:', error);
            return ApiResponse.error(res, 'Failed to reset usage', 500);
        }
    }
}

module.exports = new UsageController();
