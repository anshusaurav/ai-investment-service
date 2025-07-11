const industryService = require('../services/industryService');
const ApiResponse = require('../utils/responses');
const logger = require('../utils/logger');

class IndustryController {
    /**
     * Get all industries
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getAllIndustries(req, res) {
        try {
            const industries = await industryService.getAllIndustries();
            return ApiResponse.success(res, industries, 'Industries retrieved successfully');
        } catch (error) {
            logger.error('Error in getAllIndustries controller:', error);
            return ApiResponse.error(res, 'Failed to retrieve industries', 500);
        }
    }

    /**
     * Get industry by ID
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getIndustryById(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return ApiResponse.validationError(res, ['Industry ID is required']);
            }

            const industry = await industryService.getIndustryById(id);

            if (!industry) {
                return ApiResponse.notFound(res, 'Industry not found');
            }

            return ApiResponse.success(res, industry, 'Industry details retrieved successfully');
        } catch (error) {
            logger.error('Error in getIndustryById controller:', error);
            return ApiResponse.error(res, 'Failed to retrieve industry details', 500);
        }
    }

    /**
     * Search industries
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async searchIndustries(req, res) {
        try {
            const { q } = req.query;

            if (!q) {
                return ApiResponse.validationError(res, ['Search query is required']);
            }

            if (q.length < 2) {
                return ApiResponse.validationError(res, ['Search query must be at least 2 characters long']);
            }

            const industries = await industryService.searchIndustries(q);

            return ApiResponse.success(res, {
                industries,
                count: industries.length,
                searchTerm: q
            }, 'Industry search completed successfully');
        } catch (error) {
            logger.error('Error in searchIndustries controller:', error);
            return ApiResponse.error(res, 'Failed to search industries', 500);
        }
    }

    /**
     * Get industry statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getIndustryStats(req, res) {
        try {
            const stats = await industryService.getIndustryStats();
            return ApiResponse.success(res, stats, 'Industry statistics retrieved successfully');
        } catch (error) {
            logger.error('Error in getIndustryStats controller:', error);
            return ApiResponse.error(res, 'Failed to retrieve industry statistics', 500);
        }
    }
}

module.exports = new IndustryController();