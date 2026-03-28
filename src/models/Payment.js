const mongodb = require('../config/mongodb');
const logger = require('../utils/logger');

class Payment {
  constructor() {
    this.collectionName = 'payments';
  }

  getCollection() {
    const db = mongodb.getDb();
    return db.collection(this.collectionName);
  }

  async create(paymentData) {
    try {
      const collection = this.getCollection();
      const doc = {
        razorpayPaymentId: paymentData.razorpayPaymentId,
        razorpayOrderId: paymentData.razorpayOrderId,
        userId: paymentData.userId,
        amount: paymentData.amount,       // in paise (as Razorpay returns)
        currency: paymentData.currency || 'INR',
        status: paymentData.status || 'authorized', // authorized | captured | failed | refunded
        method: paymentData.method || null,          // card | upi | netbanking | wallet
        email: paymentData.email || null,
        contact: paymentData.contact || null,
        signature: paymentData.signature || null,    // stored for audit
        capturedAt: paymentData.capturedAt || null,
        errorCode: paymentData.errorCode || null,
        errorDescription: paymentData.errorDescription || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await collection.insertOne(doc);
      logger.info(`Payment saved to DB: ${doc.razorpayPaymentId}`);
      return { _id: result.insertedId, ...doc };
    } catch (error) {
      logger.error('Error saving payment to DB:', error);
      throw error;
    }
  }

  async findByRazorpayPaymentId(razorpayPaymentId) {
    const collection = this.getCollection();
    return collection.findOne({ razorpayPaymentId });
  }

  async updateStatus(razorpayPaymentId, status, extra = {}) {
    const collection = this.getCollection();
    const result = await collection.findOneAndUpdate(
      { razorpayPaymentId },
      { $set: { status, ...extra, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result.value;
  }

  async findByUserId(userId, limit = 20, skip = 0) {
    const collection = this.getCollection();
    return collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async createIndexes() {
    const collection = this.getCollection();
    await collection.createIndex({ razorpayPaymentId: 1 }, { unique: true });
    await collection.createIndex({ razorpayOrderId: 1 });
    await collection.createIndex({ userId: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ createdAt: -1 });
    logger.info('Payment collection indexes created');
  }
}

module.exports = new Payment();