const express = require('express');
const router = express.Router();
const industryController = require('../controllers/industryController');

/**
 * @route GET /api/industry
 * @description Get all industries
 * @access Public
 */
router.get('/', industryController.getAllIndustries);

/**
 * @route GET /api/industry/:id
 * @description Get industry by ID
 * @access Public
 */
router.get('/:id', industryController.getIndustryById);

/**
 * @route GET /api/industry/search
 * @description Search industries
 * @access Public
 */
router.get('/search', industryController.searchIndustries);

/**
 * @route GET /api/industries/stats/summary
 * @description Get industry statistics
 * @access Public
 */
router.get('/stats/summary', industryController.getIndustryStats);

module.exports = router;