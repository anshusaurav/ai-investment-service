const mongodb = require('../config/mongodb');
const logger = require('../utils/logger');

class WebhookEvent {
  constructor() {
    this.collectionName = 'webhook_events';
  }

  getCollection() {
    const db = mongodb.getDb();
    return db.collection(this.collectionName);
  }

  async create(eventData) {
    try {
      const collection = this.getCollection();
      const doc = {
        event: eventData.event,
        entityId: eventData.entityId,
        payload: eventData.payload,
        status: eventData.status || 'processed', // processed | failed
        processedAt: new Date()
      };
      const result = await collection.insertOne(doc);
      return { _id: result.insertedId, ...doc };
    } catch (error) {
      logger.error('Error saving webhook event to DB:', error);
      // Don't throw — webhook audit logging should never break the response
    }
  }

  async createIndexes() {
    const collection = this.getCollection();
    await collection.createIndex({ event: 1 });
    await collection.createIndex({ entityId: 1 });
    await collection.createIndex({ processedAt: -1 });
    logger.info('WebhookEvent collection indexes created');
  }
}

module.exports = new WebhookEvent();