const express = require('express');
const companyController = require('../controllers/companyController');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

/**
 * @route GET /api/company/:id
 * @desc Get company details by ID (includes inWatchlist for authenticated users)
 * @access Public (optional authentication)
 */
router.get('/:id', optionalAuth, companyController.getCompanyById);

/**
 * @route GET /api/company
 * @desc Get companies by criteria
 * @access Public
 * @query {string} [status] - Company status (active, inactive)
 * @query {string} [industry] - Company industry
 * @query {string} [location] - Company location
 * @query {string} [size] - Company size (small, medium, large)
 * @query {number} [limit] - Number of results to return (default: 10)
 */
router.get('/', authLimiter, companyController.getCompaniesByCriteria);

/**
 * @route GET /api/company/search
 * @desc Search companies by name or keywords
 * @access Public
 * @query {string} q - Search query
 */
router.post('/search', authLimiter, companyController.searchCompanies);

/**
 * @route GET /api/company/getCompaniesByIndustry
 * @desc Search companies by industry link
 * @access Public
 * @query {string} q - Search query
 */
router.post('/searchByIndustryLink', companyController.searchCompaniesByIndustryLink);

/**
 * @route GET /api/company/industries
 * @desc Get list of all industries
 * @access Public
 */
router.get('/industries', authLimiter, companyController.getIndustryList);

/**
 * @route POST /api/company/follow
 * @desc Follow a company (add to watchlist)
 * @access Private (requires JWT token)
 * @body {string} companyCode - Company code to follow
 */
router.post('/follow', authLimiter, authenticateToken, validate(schemas.followCompany), companyController.followCompany);

/**
 * @route POST /api/company/unfollow
 * @desc Unfollow a company (remove from watchlist)
 * @access Private (requires JWT token)
 * @body {string} companyCode - Company code to unfollow
 */
router.post('/unfollow', authLimiter, authenticateToken, validate(schemas.unfollowCompany), companyController.unfollowCompany);



/**
 * @route GET /api/company/stats
 * @desc Get company statistics
 * @access Public
 */
router.get('/stats', authLimiter, companyController.getCompanyStats);

/**
 * @route DELETE /api/company/cache/:companyId?
 * @desc Clear cache for specific company or all companies
 * @access Public (you might want to add admin auth)
 */
router.delete('/cache/:companyId?', authLimiter, companyController.clearCache);

/**
 * @route GET /api/company/by-name
 * @desc Get company by exact name
 * @access Public
 * @query {string} name - Company name
 */
router.get('/by-name', authLimiter, companyController.getCompanyByName);

module.exports = router;