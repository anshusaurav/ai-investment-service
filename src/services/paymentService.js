const { razorpay } = require('../config/razorpay');
const crypto = require('crypto');
const logger = require('../utils/logger');
const OrderModel = require('../models/Order');
const PaymentModel = require('../models/Payment');
const RefundModel = require('../models/Refund');
const WebhookEventModel = require('../models/WebhookEvent');

class PaymentService {
  /**
   * Create a Razorpay order and persist to DB
   */
  async createOrder(orderData, userId) {
    if (!razorpay) throw new Error('Razorpay not initialized. Please check your credentials.');

    const amountInPaise = Math.round(orderData.amount * 100);
    const receipt = orderData.receipt || `receipt_${Date.now()}`;

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: orderData.currency || 'INR',
      receipt,
      notes: orderData.notes || {}
    });

    logger.info(`Razorpay order created: ${razorpayOrder.id}`);

    const savedOrder = await OrderModel.create({
      razorpayOrderId: razorpayOrder.id,
      userId,
      amount: orderData.amount,
      amountInPaise,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt,
      status: razorpayOrder.status,
      notes: razorpayOrder.notes,
      attempts: razorpayOrder.attempts
    });

    return { razorpayOrder, savedOrder };
  }

  /**
   * Verify payment signature and persist payment to DB
   */
  verifyPaymentSignature(paymentData) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    const isValid = expectedSignature === razorpay_signature;
    logger.info(`Payment signature verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
    return isValid;
  }

  /**
   * Fetch payment from Razorpay and save to DB after successful verification
   */
  async captureVerifiedPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature, userId) {
    if (!razorpay) throw new Error('Razorpay not initialized. Please check your credentials.');

    const rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);

    const existing = await PaymentModel.findByRazorpayPaymentId(razorpay_payment_id);
    if (!existing) {
      await PaymentModel.create({
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        userId,
        amount: rzpPayment.amount,
        currency: rzpPayment.currency,
        status: rzpPayment.status,
        method: rzpPayment.method,
        email: rzpPayment.email,
        contact: rzpPayment.contact,
        signature: razorpay_signature,
        capturedAt: rzpPayment.captured_at ? new Date(rzpPayment.captured_at * 1000) : null
      });
    }

    // Update the order status to attempted/paid
    await OrderModel.updateStatus(razorpay_order_id, 'attempted');

    return rzpPayment;
  }

  /**
   * Get payment details from Razorpay
   */
  async getPaymentDetails(paymentId) {
    if (!razorpay) throw new Error('Razorpay not initialized. Please check your credentials.');
    const payment = await razorpay.payments.fetch(paymentId);
    logger.info(`Payment details fetched: ${paymentId}`);
    return payment;
  }

  /**
   * Get order details from Razorpay
   */
  async getOrderDetails(orderId) {
    if (!razorpay) throw new Error('Razorpay not initialized. Please check your credentials.');
    const order = await razorpay.orders.fetch(orderId);
    logger.info(`Order details fetched: ${orderId}`);
    return order;
  }

  /**
   * Create refund and persist to DB
   */
  async createRefund(paymentId, refundData, userId) {
    if (!razorpay) throw new Error('Razorpay not initialized. Please check your credentials.');

    const options = {
      notes: refundData.notes || {}
    };
    if (refundData.amount) options.amount = refundData.amount; // in paise

    const refund = await razorpay.payments.refund(paymentId, options);

    logger.info(`Razorpay refund created: ${refund.id}`);

    await RefundModel.create({
      razorpayRefundId: refund.id,
      razorpayPaymentId: paymentId,
      userId,
      amount: refund.amount,
      currency: refund.currency,
      status: 'pending',
      notes: refund.notes || {}
    });

    // Update payment status
    await PaymentModel.updateStatus(paymentId, 'refunded');

    return refund;
  }

  /**
   * Get user payment history from DB (orders + payments joined)
   */
  async getPaymentHistory(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [payments, orders] = await Promise.all([
      PaymentModel.findByUserId(userId, limit, skip),
      OrderModel.findByUserId(userId, limit, skip)
    ]);
    return { payments, orders };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body, signature) {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return false;
    }
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');
    const isValid = expectedSignature === signature;
    logger.info(`Webhook signature verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
    return isValid;
  }

  /**
   * Process a verified webhook event and update DB state
   */
  async processWebhookEvent(event, payload) {
    const entityId = this._extractEntityId(event, payload);

    switch (event) {
      case 'payment.captured': {
        const p = payload.payment.entity;
        await PaymentModel.updateStatus(p.id, 'captured', { capturedAt: new Date() });
        await OrderModel.updateStatus(p.order_id, 'paid');
        break;
      }
      case 'payment.failed': {
        const p = payload.payment.entity;
        await PaymentModel.updateStatus(p.id, 'failed', {
          errorCode: p.error_code,
          errorDescription: p.error_description
        });
        break;
      }
      case 'payment.authorized': {
        const p = payload.payment.entity;
        await PaymentModel.updateStatus(p.id, 'authorized');
        break;
      }
      case 'order.paid': {
        const o = payload.order.entity;
        await OrderModel.updateStatus(o.id, 'paid');
        break;
      }
      case 'refund.created': {
        const r = payload.refund.entity;
        const existing = await RefundModel.findByRazorpayRefundId(r.id);
        if (!existing) {
          await RefundModel.create({
            razorpayRefundId: r.id,
            razorpayPaymentId: r.payment_id,
            userId: null, // unknown from webhook — can be enriched later
            amount: r.amount,
            currency: r.currency,
            status: 'pending',
            notes: r.notes || {}
          });
        }
        break;
      }
      case 'refund.processed': {
        const r = payload.refund.entity;
        await RefundModel.updateStatus(r.id, 'processed');
        break;
      }
      case 'refund.failed': {
        const r = payload.refund.entity;
        await RefundModel.updateStatus(r.id, 'failed');
        break;
      }
      default:
        logger.info(`Unhandled webhook event: ${event}`);
    }

    // Audit log every event
    await WebhookEventModel.create({ event, entityId, payload, status: 'processed' });
  }

  _extractEntityId(event, payload) {
    const [resource] = event.split('.');
    const entityMap = {
      payment: payload.payment?.entity?.id,
      order: payload.order?.entity?.id,
      refund: payload.refund?.entity?.id
    };
    return entityMap[resource] || null;
  }
}

module.exports = new PaymentService();