const mongodb = require('../config/mongodb');
const logger = require('../utils/logger');

class Order {
  constructor() {
    this.collectionName = 'orders';
  }

  getCollection() {
    const db = mongodb.getDb();
    return db.collection(this.collectionName);
  }

  async create(orderData) {
    try {
      const collection = this.getCollection();
      const doc = {
        razorpayOrderId: orderData.razorpayOrderId,
        userId: orderData.userId,
        amount: orderData.amount,             // in rupees
        amountInPaise: orderData.amountInPaise,
        currency: orderData.currency || 'INR',
        receipt: orderData.receipt,
        status: orderData.status || 'created', // created | attempted | paid
        notes: orderData.notes || {},
        attempts: orderData.attempts || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await collection.insertOne(doc);
      logger.info(`Order saved to DB: ${doc.razorpayOrderId}`);
      return { _id: result.insertedId, ...doc };
    } catch (error) {
      logger.error('Error saving order to DB:', error);
      throw error;
    }
  }

  async findByRazorpayOrderId(razorpayOrderId) {
    const collection = this.getCollection();
    return collection.findOne({ razorpayOrderId });
  }

  async updateStatus(razorpayOrderId, status, extra = {}) {
    const collection = this.getCollection();
    const result = await collection.findOneAndUpdate(
      { razorpayOrderId },
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
    await collection.createIndex({ razorpayOrderId: 1 }, { unique: true });
    await collection.createIndex({ userId: 1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ createdAt: -1 });
    logger.info('Order collection indexes created');
  }
}

module.exports = new Order();