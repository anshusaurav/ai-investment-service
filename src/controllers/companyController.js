const companyService = require('../services/companyService');
const ApiResponse = require('../utils/responses');
const logger = require('../utils/logger');

class CompanyController {
    /**
     * Get company details by ID
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getCompanyById(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return ApiResponse.validationError(res, ['Company ID is required']);
            }

            const company = await companyService.getCompanyById(id);

            if (!company) {
                return ApiResponse.notFound(res, 'Company not found');
            }

            return ApiResponse.success(res, company, 'Company details retrieved successfully');
        } catch (error) {
            logger.error('Error in getCompanyById controller:', error);
            return ApiResponse.error(res, 'Failed to retrieve company details', 500);
        }
    }

    /**
     * Get companies by criteria
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getCompaniesByCriteria(req, res) {
        try {
            const criteria = {
                status: req.query.status,
                industry: req.query.industry,
                location: req.query.location,
                size: req.query.size,
                limit: parseInt(req.query.limit) || 10
            };

            // Remove undefined values
            Object.keys(criteria).forEach(key => {
                if (criteria[key] === undefined) {
                    delete criteria[key];
                }
            });

            const companies = await companyService.getCompaniesByCriteria(criteria);

            return ApiResponse.success(res, {
                companies,
                count: companies.length,
                criteria
            }, 'Companies retrieved successfully');
        } catch (error) {
            logger.error('Error in getCompaniesByCriteria controller:', error);
            return ApiResponse.error(res, 'Failed to retrieve companies', 500);
        }
    }

    /**
     * Get company by name
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getCompanyByName(req, res) {
        try {
            const { name } = req.query;

            if (!name) {
                return ApiResponse.validationError(res, ['Company name is required']);
            }

            const company = await companyService.getCompanyByName(name);

            if (!company) {
                return ApiResponse.notFound(res, 'Company not found');
            }

            return ApiResponse.success(res, company, 'Company details retrieved successfully');
        } catch (error) {
            logger.error('Error in getCompanyByName controller:', error);
            return ApiResponse.error(res, 'Failed to retrieve company details', 500);
        }
    }

    /**
     * Search companies
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async searchCompanies(req, res) {
        try {
            const { q } = req.query;

            if (!q) {
                return ApiResponse.validationError(res, ['Search query is required']);
            }

            if (q.length < 2) {
                return ApiResponse.validationError(res, ['Search query must be at least 2 characters long']);
            }

            const companies = await companyService.searchCompanies(q);

            return ApiResponse.success(res, {
                companies,
                count: companies.length,
                searchTerm: q
            }, 'Company search completed successfully');
        } catch (error) {
            logger.error('Error in searchCompanies controller:', error);
            return ApiResponse.error(res, 'Failed to search companies', 500);
        }
    }

    /**
     * Get company statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getCompanyStats(req, res) {
        try {
            const stats = await companyService.getCompanyStats();

            return ApiResponse.success(res, stats, 'Company statistics retrieved successfully');
        } catch (error) {
            logger.error('Error in getCompanyStats controller:', error);
            return ApiResponse.error(res, 'Failed to retrieve company statistics', 500);
        }
    }
}

module.exports = new CompanyController();