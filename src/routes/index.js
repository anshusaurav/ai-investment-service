const express = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./user');
const companyRoutes = require('./company');
const industryRoutes = require('./industry');
// const chatRoutes = require('./chat');
const paymentRoutes = require('./payment');
const { generalLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply general rate limiter
router.use(generalLimiter);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
// API version info
router.get('/', (req, res) => {
    res.json({
        message: 'Firebase Auth API',
        version: '1.0.0',
        endpoints: {
            auth: {
                googleSignUp: 'POST /api/auth/signup/google',
                googleSignIn: 'POST /api/auth/signin/google',
                refreshToken: 'POST /api/auth/refresh-token'
            },
            user: {
                profile: 'GET /api/user/profile',
                updateProfile: 'PUT /api/user/profile',
                watchlist: 'GET /api/user/watchlist',
                addToWatchlist: 'POST /api/user/watchlist',
                removeFromWatchlist: 'DELETE /api/user/watchlist'
            },
            company: '/api/company',
            industry: '/api/industry',
            payment: {
                createOrder: 'POST /api/payment/create-order',
                verifyPayment: 'POST /api/payment/verify',
                getPayment: 'GET /api/payment/payment/:paymentId',
                getOrder: 'GET /api/payment/order/:orderId',
                createRefund: 'POST /api/payment/refund/:paymentId',
                webhook: 'POST /api/payment/webhook'
            },
            health: '/health'
        },
        documentation: '/docs'
    });
});

// Route handlers
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/company', companyRoutes);
router.use('/industry', industryRoutes);
// router.use('/chat', chatRoutes);
router.use('/payment', paymentRoutes);

module.exports = router;