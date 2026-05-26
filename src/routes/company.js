const express = require('express');
const companyController = require('../controllers/companyController');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

// ── Static routes first — must be registered before /:id ─────────────────────

/**
 * @route GET /api/company
 * @desc Get companies by criteria
 * @access Public
 */
router.get('/', authLimiter, companyController.getCompaniesByCriteria);

/**
 * @route POST /api/company/search
 * @desc Search companies by name or keywords
 * @access Public
 * @body {string} q - Search query
 */
router.post('/search', authLimiter, companyController.searchCompanies);

/**
 * @route POST /api/company/searchByIndustryLink
 * @desc Search companies by industry link
 * @access Public
 */
router.post('/searchByIndustryLink', companyController.searchCompaniesByIndustryLink);

/**
 * @route GET /api/company/industries
 * @desc Get list of all industries
 * @access Public
 */
router.get('/industries', authLimiter, companyController.getIndustryList);

/**
 * @route GET /api/company/stats
 * @desc Get company statistics
 * @access Public
 */
router.get('/stats', authLimiter, companyController.getCompanyStats);

/**
 * @route GET /api/company/by-name
 * @desc Get company by exact name
 * @access Public
 * @query {string} name - Company name
 */
router.get('/by-name', authLimiter, companyController.getCompanyByName);

/**
 * @route POST /api/company/follow
 * @desc Follow a company (add to watchlist)
 * @access Private
 */
router.post('/follow', authLimiter, authenticateToken, validate(schemas.followCompany), companyController.followCompany);

/**
 * @route POST /api/company/unfollow
 * @desc Unfollow a company (remove from watchlist)
 * @access Private
 */
router.post('/unfollow', authLimiter, authenticateToken, validate(schemas.unfollowCompany), companyController.unfollowCompany);

/**
 * @route DELETE /api/company/cache/:companyId?
 * @desc Clear cache for specific company or all companies
 * @access Public
 */
router.delete('/cache/:companyId?', authLimiter, companyController.clearCache);

// ── Dynamic route last — must come after all static routes ────────────────────

/**
 * @route GET /api/company/:id
 * @desc Get company details by ID (includes inWatchlist for authenticated users)
 * @access Public (optional authentication)
 */
router.get('/:id', optionalAuth, companyController.getCompanyById);

module.exports = router;