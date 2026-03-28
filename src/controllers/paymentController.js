const paymentService = require('../services/paymentService');
const ApiResponse = require('../utils/responses');
const logger = require('../utils/logger');

const createOrder = async (req, res) => {
  try {
    const { amount, currency, receipt, notes } = req.body;
    if (!amount || amount <= 0) {
      return ApiResponse.error(res, 'Valid amount is required', 400);
    }
    const { razorpayOrder, savedOrder } = await paymentService.createOrder(
      { amount: parseFloat(amount), currency, receipt, notes },
      req.user.uid
    );
    return ApiResponse.success(res, { order: razorpayOrder, savedOrder }, 'Order created successfully');
  } catch (error) {
    logger.error('Error in createOrder:', error);
    return ApiResponse.error(res, error.message, 500);
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return ApiResponse.error(res, 'Missing required payment verification data', 400);
    }

    const isValid = paymentService.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!isValid) {
      return ApiResponse.error(res, 'Payment verification failed', 400);
    }

    const payment = await paymentService.captureVerifiedPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      req.user.uid
    );

    return ApiResponse.success(res, { verified: true, payment }, 'Payment verified successfully');
  } catch (error) {
    logger.error('Error in verifyPayment:', error);
    return ApiResponse.error(res, error.message, 500);
  }
};

const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!paymentId) return ApiResponse.error(res, 'Payment ID is required', 400);
    const payment = await paymentService.getPaymentDetails(paymentId);
    return ApiResponse.success(res, { payment }, 'Payment details retrieved successfully');
  } catch (error) {
    logger.error('Error in getPaymentDetails:', error);
    return ApiResponse.error(res, error.message, 500);
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return ApiResponse.error(res, 'Order ID is required', 400);
    const order = await paymentService.getOrderDetails(orderId);
    return ApiResponse.success(res, { order }, 'Order details retrieved successfully');
  } catch (error) {
    logger.error('Error in getOrderDetails:', error);
    return ApiResponse.error(res, error.message, 500);
  }
};

const createRefund = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, notes } = req.body;
    if (!paymentId) return ApiResponse.error(res, 'Payment ID is required', 400);

    const refundData = {
      amount: amount ? Math.round(amount * 100) : undefined, // convert to paise
      notes: notes || {}
    };
    const refund = await paymentService.createRefund(paymentId, refundData, req.user.uid);
    return ApiResponse.success(res, { refund }, 'Refund created successfully');
  } catch (error) {
    logger.error('Error in createRefund:', error);
    return ApiResponse.error(res, error.message, 500);
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const history = await paymentService.getPaymentHistory(req.user.uid, page, limit);
    return ApiResponse.success(res, { ...history, page, limit }, 'Payment history retrieved successfully');
  } catch (error) {
    logger.error('Error in getPaymentHistory:', error);
    return ApiResponse.error(res, error.message, 500);
  }
};

const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.rawBody || JSON.stringify(req.body);

    if (!signature) {
      return ApiResponse.error(res, 'Missing webhook signature', 400);
    }

    const isValid = paymentService.verifyWebhookSignature(body, signature);
    if (!isValid) {
      return ApiResponse.error(res, 'Invalid webhook signature', 400);
    }

    const { event, payload } = req.body;
    logger.info(`Webhook received: ${event}`);

    await paymentService.processWebhookEvent(event, payload);

    return ApiResponse.success(res, {}, 'Webhook processed successfully');
  } catch (error) {
    logger.error('Error in handleWebhook:', error);
    return ApiResponse.error(res, error.message, 500);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentDetails,
  getOrderDetails,
  createRefund,
  getPaymentHistory,
  handleWebhook
};