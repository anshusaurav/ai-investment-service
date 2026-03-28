const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');
const rawBodyMiddleware = require('../middleware/rawBody');

// Create order (protected route)
router.post('/create-order', authenticateToken, paymentController.createOrder);

// Verify payment (protected route)
router.post('/verify', authenticateToken, paymentController.verifyPayment);

// Get payment details (protected route)
router.get('/payment/:paymentId', authenticateToken, paymentController.getPaymentDetails);

// Get order details (protected route)
router.get('/order/:orderId', authenticateToken, paymentController.getOrderDetails);

// Create refund (protected route)
router.post('/refund/:paymentId', authenticateToken, paymentController.createRefund);

// Get payment history for logged-in user (protected route)
router.get('/history', authenticateToken, paymentController.getPaymentHistory);

// Webhook endpoint (public - no auth required, with raw body middleware)
router.post('/webhook', rawBodyMiddleware, paymentController.handleWebhook);

module.exports = router;