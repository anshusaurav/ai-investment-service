const { MongoClient } = require('mongodb');
const logger = require('../utils/logger');

class MongoDB {
    constructor() {
        this.client = null;
        this.db = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            if (this.isConnected) {
                return this.db;
            }

            const uri = process.env.MONGODB_URI;
            const dbName = process.env.MONGODB_DATABASE;

            if (!uri || !dbName) {
                throw new Error('MongoDB URI and database name must be provided in environment variables');
            }

            this.client = new MongoClient(uri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 30000,
                tls: true,
                tlsAllowInvalidCertificates: false,
                tlsAllowInvalidHostnames: false,
                retryWrites: true,
                w: 'majority'
            });

            await this.client.connect();
            this.db = this.client.db(dbName);
            this.isConnected = true;

            logger.info('Successfully connected to MongoDB');
            return this.db;
        } catch (error) {
            logger.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.close();
                this.isConnected = false;
                logger.info('Disconnected from MongoDB');
            }
        } catch (error) {
            logger.error('Error disconnecting from MongoDB:', error);
        }
    }

    getDb() {
        if (!this.isConnected || !this.db) {
            throw new Error('MongoDB not connected. Call connect() first.');
        }
        return this.db;
    }

    getCollection(collectionName = null) {
        const db = this.getDb();
        const collection = collectionName || process.env.MONGODB_COLLECTION || 'companies';
        return db.collection(collection);
    }
}

module.exports = new MongoDB();