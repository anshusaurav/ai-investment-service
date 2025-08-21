const companyService = require("../services/companyService");
const watchlistService = require("../services/watchlistService");
const ApiResponse = require("../utils/responses");
const logger = require("../utils/logger");

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
        return ApiResponse.validationError(res, ["Company ID is required"]);
      }

      const company = await companyService.getCompanyById(id);

      if (!company) {
        return ApiResponse.notFound(res, "Company not found");
      }

      return ApiResponse.success(
        res,
        company,
        "Company details retrieved successfully"
      );
    } catch (error) {
      logger.error("Error in getCompanyById controller:", error);
      return ApiResponse.error(res, "Failed to retrieve company details", 500);
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
        limit: parseInt(req.query.limit) || 10,
      };

      // Remove undefined values
      Object.keys(criteria).forEach((key) => {
        if (criteria[key] === undefined) {
          delete criteria[key];
        }
      });

      const companies = await companyService.getCompaniesByCriteria(criteria);

      return ApiResponse.success(
        res,
        {
          companies,
          count: companies.length,
          criteria,
        },
        "Companies retrieved successfully"
      );
    } catch (error) {
      logger.error("Error in getCompaniesByCriteria controller:", error);
      return ApiResponse.error(res, "Failed to retrieve companies", 500);
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
        return ApiResponse.validationError(res, ["Company name is required"]);
      }

      const company = await companyService.getCompanyByIndustry(name);

      if (!company) {
        return ApiResponse.notFound(res, "Company not found");
      }

      return ApiResponse.success(
        res,
        company,
        "Company details retrieved successfully"
      );
    } catch (error) {
      logger.error("Error in getCompanyByName controller:", error);
      return ApiResponse.error(res, "Failed to retrieve company details", 500);
    }
  }

  /**
   * Search companies
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchCompanies(req, res) {
    // console.log('HERE',req.query);
    try {
      const { q } = req.body;
      console.log(q);
      if (!q) {
        return ApiResponse.validationError(res, ["Search query is required"]);
      }

      if (q.length < 2) {
        return ApiResponse.validationError(res, [
          "Search query must be at least 2 characters long",
        ]);
      }

      const companies = await companyService.searchCompanies(q);
      return ApiResponse.success(
        res,
        {
          companies,
          count: companies.length,
          searchTerm: q,
        },
        "Company search completed successfully"
      );
    } catch (error) {
      logger.error("Error in searchCompanies controller:", error);
      return ApiResponse.error(res, "Failed to search companies", 500);
    }
  }
  /**
   * Get companies list by industry link
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchCompaniesByIndustryLink(req, res) {
    try {
      const { industryPath } = req.body;

      if (!industryPath) {
        return ApiResponse.validationError(res, ['Industry is required']);
      }
      const companies = await companyService.getCompanyByIndustry(industryPath);

      if (!companies) {
        return ApiResponse.notFound(res, 'Companies not found');
      }

      return ApiResponse.success(res, companies, 'success');
    } catch (error) {
      logger.error('Error in getCompanyByIndustry controller:', error);
      return ApiResponse.error(res, 'Failed to retrieve companies', 500);
    }
  }

  /**
   * Get industry list
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getIndustryList(req, res) {
    try {
      const industries = await companyService.getIndustryList();

      return ApiResponse.success(
        res,
        {
          industries,
          count: industries.length
        },
        "Industry list retrieved successfully"
      );
    } catch (error) {
      logger.error("Error in getIndustryList controller:", error);
      return ApiResponse.error(res, "Failed to retrieve industry list", 500);
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

      return ApiResponse.success(
        res,
        stats,
        "Company statistics retrieved successfully"
      );
    } catch (error) {
      logger.error("Error in getCompanyStats controller:", error);
      return ApiResponse.error(
        res,
        "Failed to retrieve company statistics",
        500
      );
    }
  }

  /**
   * Follow a company (add to watchlist)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async followCompany(req, res) {
    try {
      const { companyCode } = req.body;
      const userId = req.user.uid;

      if (!companyCode) {
        return ApiResponse.validationError(res, ["Company code is required"]);
      }

      // Check if company exists
      const company = await companyService.getCompanyById(companyCode);
      if (!company) {
        return ApiResponse.notFound(res, "Company not found");
      }

      const result = await watchlistService.followCompany(userId, companyCode);

      return ApiResponse.success(
        res,
        { watchlist: result.companyCodes },
        `Successfully followed ${companyCode}`
      );
    } catch (error) {
      logger.error("Error in followCompany controller:", error);
      return ApiResponse.error(res, "Failed to follow company", 500);
    }
  }

  /**
   * Unfollow a company (remove from watchlist)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async unfollowCompany(req, res) {
    try {
      const { companyCode } = req.body;
      const userId = req.user.uid;

      if (!companyCode) {
        return ApiResponse.validationError(res, ["Company code is required"]);
      }

      const result = await watchlistService.unfollowCompany(userId, companyCode);

      return ApiResponse.success(
        res,
        { watchlist: result.companyCodes },
        `Successfully unfollowed ${companyCode}`
      );
    } catch (error) {
      logger.error("Error in unfollowCompany controller:", error);
      return ApiResponse.error(res, "Failed to unfollow company", 500);
    }
  }



  /**
   * Clear company cache
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async clearCache(req, res) {
    try {
      const { companyId } = req.params;

      if (companyId) {
        await companyService.clearCompanyCache(companyId);
        return ApiResponse.success(res, null, `Cache cleared for company: ${companyId}`);
      } else {
        await companyService.clearAllCache();
        return ApiResponse.success(res, null, "All company caches cleared");
      }
    } catch (error) {
      logger.error("Error in clearCache controller:", error);
      return ApiResponse.error(res, "Failed to clear cache", 500);
    }
  }
}

module.exports = new CompanyController();
