const express = require('express');
const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

// Apply auth rate limiter to all routes
router.use(authLimiter);

// Token verification endpoints
router.post('/verify-token',
    validate(schemas.verifyToken),
    authController.verifyToken
);

// Create custom token
router.post('/create-custom-token',
    authController.createCustomToken
);

// Revoke refresh tokens
// router.post('/revoke-refresh-tokens',
//     authController.revokeRefreshTokens
// );


module.exports = router;