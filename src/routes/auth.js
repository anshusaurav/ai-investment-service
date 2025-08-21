const express = require('express');
const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../utils/validators');

const router = express.Router();

// Apply auth rate limiter to all routes
router.use(authLimiter);

// Google Sign Up - for new users
router.post('/signup/google',
    validate(schemas.googleSignUp),
    authController.googleSignUp
);

// Google Sign In - for existing users
router.post('/signin/google',
    validate(schemas.googleSignIn),
    authController.googleSignIn
);

// Refresh expired Firebase token
router.post('/refresh-token',
    validate(schemas.refreshToken),
    authController.refreshToken
);

module.exports = router;