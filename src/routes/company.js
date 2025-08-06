const express = require('express');
const companyController = require('../controllers/companyController');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

/**
 * @route GET /api/company/:id
 * @desc Get company details by ID
 * @access Public (you can add auth middleware if needed)
 */
router.get('/:id', companyController.getCompanyById);

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
router.post('/searchByIndustryLink', authLimiter, companyController.searchCompaniesByIndustryLink);

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

module.exports = router;