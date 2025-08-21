const express = require('express');
const userController = require('../controllers/userController');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

// Apply auth rate limiter to all routes
router.use(authLimiter);

/**
 * @route GET /api/user/profile
 * @desc Get user profile
 * @access Private (requires JWT token)
 */
router.get('/profile', authenticateToken, userController.getUserProfile);

/**
 * @route PUT /api/user/profile
 * @desc Update user profile
 * @access Private (requires JWT token)
 */
router.put('/profile', authenticateToken, userController.updateUserProfile);

/**
 * @route GET /api/user/watchlist
 * @desc Get user's watchlist
 * @access Private (requires JWT token)
 */
router.get('/watchlist', authenticateToken, userController.getWatchlist);

/**
 * @route POST /api/user/watchlist
 * @desc Add company to watchlist
 * @access Private (requires JWT token)
 */
router.post('/watchlist', 
    authenticateToken, 
    validate(schemas.followCompany), 
    userController.addToWatchlist
);

/**
 * @route DELETE /api/user/watchlist
 * @desc Remove company from watchlist
 * @access Private (requires JWT token)
 */
router.delete('/watchlist', 
    authenticateToken, 
    validate(schemas.unfollowCompany), 
    userController.removeFromWatchlist
);

module.exports = router;