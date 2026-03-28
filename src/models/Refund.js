const mongodb = require('../config/mongodb');
const logger = require('../utils/logger');

class Refund {
  constructor() {
    this.collectionName = 'refunds';
  }

  getCollection() {
    const db = mongodb.getDb();
    return db.collection(this.collectionName);
  }

  async create(refundData) {
    try {
      const collection = this.getCollection();
      const doc = {
        razorpayRefundId: refundData.razorpayRefundId,
        razorpayPaymentId: refundData.razorpayPaymentId,
        userId: refundData.userId,
        amount: refundData.amount || null, // in paise, null = full refund
        currency: refundData.currency || 'INR',
        status: refundData.status || 'pending', // pending | processed | failed
        notes: refundData.notes || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await collection.insertOne(doc);
      logger.info(`Refund saved to DB: ${doc.razorpayRefundId}`);
      return { _id: result.insertedId, ...doc };
    } catch (error) {
      logger.error('Error saving refund to DB:', error);
      throw error;
    }
  }

  async findByRazorpayRefundId(razorpayRefundId) {
    const collection = this.getCollection();
    return collection.findOne({ razorpayRefundId });
  }

  async updateStatus(razorpayRefundId, status) {
    const collection = this.getCollection();
    const result = await collection.findOneAndUpdate(
      { razorpayRefundId },
      { $set: { status, updatedAt: new Date() } },
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
    await collection.createIndex({ razorpayRefundId: 1 }, { unique: true });
    await collection.createIndex({ razorpayPaymentId: 1 });
    await collection.createIndex({ userId: 1 });
    await collection.createIndex({ createdAt: -1 });
    logger.info('Refund collection indexes created');
  }
}

module.exports = new Refund();