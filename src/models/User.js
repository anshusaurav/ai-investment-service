const mongodb = require('../config/mongodb');
const logger = require('../utils/logger');

class User {
    constructor() {
        this.collectionName = 'users';
    }

    /**
     * Get the users collection
     * @returns {Collection} MongoDB collection
     */
    getCollection() {
        const db = mongodb.getDb();
        return db.collection(this.collectionName);
    }

    /**
     * Create a new user
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Created user
     */
    async create(userData) {
        try {
            const collection = this.getCollection();

            // Validate required fields
            if (!userData.uid || !userData.email) {
                throw new Error('UID and email are required');
            }

            // Check if user already exists
            const existingUser = await this.findByUid(userData.uid);
            if (existingUser) {
                throw new Error('User already exists');
            }

            const user = {
                uid: userData.uid,
                email: userData.email,
                name: userData.name || null,
                picture: userData.picture || null,
                emailVerified: userData.emailVerified || false,
                provider: userData.provider || 'google.com',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastLoginAt: new Date(),
                profile: {
                    firstName: userData.firstName || null,
                    lastName: userData.lastName || null,
                    phoneNumber: userData.phoneNumber || null,
                    dateOfBirth: userData.dateOfBirth || null,
                    address: userData.address || null
                },
                preferences: {
                    notifications: {
                        email: true,
                        push: true,
                        sms: false
                    },
                    privacy: {
                        profileVisibility: 'public'
                    }
                },
                watchlist: []
            };

            const result = await collection.insertOne(user);

            if (!result.insertedId) {
                throw new Error('Failed to create user');
            }

            logger.info(`User created successfully: ${userData.uid}`);

            return {
                _id: result.insertedId,
                ...user
            };
        } catch (error) {
            logger.error('Error creating user:', error);
            throw error;
        }
    }

    /**
     * Find user by Firebase UID
     * @param {string} uid - Firebase UID
     * @returns {Promise<Object|null>} User document
     */
    async findByUid(uid) {
        try {
            const collection = this.getCollection();
            const user = await collection.findOne({ uid });
            return user;
        } catch (error) {
            logger.error('Error finding user by UID:', error);
            throw error;
        }
    }

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<Object|null>} User document
     */
    async findByEmail(email) {
        try {
            const collection = this.getCollection();
            const user = await collection.findOne({ email });
            return user;
        } catch (error) {
            logger.error('Error finding user by email:', error);
            throw error;
        }
    }

    /**
     * Update user by UID
     * @param {string} uid - Firebase UID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object|null>} Updated user document
     */
    async updateByUid(uid, updateData) {
        try {
            const collection = this.getCollection();

            // Remove fields that shouldn't be updated directly
            const { _id, uid: userUid, createdAt, ...allowedUpdates } = updateData;

            const update = {
                ...allowedUpdates,
                updatedAt: new Date()
            };

            const result = await collection.findOneAndUpdate(
                { uid },
                { $set: update },
                { returnDocument: 'after' }
            );

            if (!result.value) {
                return null;
            }

            logger.info(`User updated successfully: ${uid}`);
            return result.value;
        } catch (error) {
            logger.error('Error updating user:', error);
            throw error;
        }
    }

    /**
     * Update user's last login time
     * @param {string} uid - Firebase UID
     * @returns {Promise<boolean>} Success status
     */
    async updateLastLogin(uid) {
        try {
            const collection = this.getCollection();

            const result = await collection.updateOne(
                { uid },
                {
                    $set: {
                        lastLoginAt: new Date(),
                        updatedAt: new Date()
                    }
                }
            );

            return result.modifiedCount > 0;
        } catch (error) {
            logger.error('Error updating last login:', error);
            throw error;
        }
    }

    /**
     * Add company to user's watchlist
     * @param {string} uid - Firebase UID
     * @param {string} companyCode - Company code to add
     * @returns {Promise<boolean>} Success status
     */
    async addToWatchlist(uid, companyCode) {
        try {
            const collection = this.getCollection();

            const result = await collection.updateOne(
                { uid },
                {
                    $addToSet: { watchlist: companyCode },
                    $set: { updatedAt: new Date() }
                }
            );

            return result.modifiedCount > 0;
        } catch (error) {
            logger.error('Error adding to watchlist:', error);
            throw error;
        }
    }

    /**
     * Remove company from user's watchlist
     * @param {string} uid - Firebase UID
     * @param {string} companyCode - Company code to remove
     * @returns {Promise<boolean>} Success status
     */
    async removeFromWatchlist(uid, companyCode) {
        try {
            const collection = this.getCollection();

            const result = await collection.updateOne(
                { uid },
                {
                    $pull: { watchlist: companyCode },
                    $set: { updatedAt: new Date() }
                }
            );

            return result.modifiedCount > 0;
        } catch (error) {
            logger.error('Error removing from watchlist:', error);
            throw error;
        }
    }

    /**
     * Get user's watchlist
     * @param {string} uid - Firebase UID
     * @returns {Promise<Array>} User's watchlist
     */
    async getWatchlist(uid) {
        try {
            const collection = this.getCollection();
            const user = await collection.findOne(
                { uid },
                { projection: { watchlist: 1 } }
            );

            return user ? user.watchlist || [] : [];
        } catch (error) {
            logger.error('Error getting watchlist:', error);
            throw error;
        }
    }

    /**
     * Delete user by UID
     * @param {string} uid - Firebase UID
     * @returns {Promise<boolean>} Success status
     */
    async deleteByUid(uid) {
        try {
            const collection = this.getCollection();
            const result = await collection.deleteOne({ uid });

            logger.info(`User deleted: ${uid}`);
            return result.deletedCount > 0;
        } catch (error) {
            logger.error('Error deleting user:', error);
            throw error;
        }
    }

    /**
     * Create indexes for the users collection
     * @returns {Promise<void>}
     */
    async createIndexes() {
        try {
            const collection = this.getCollection();

            // Create indexes for better query performance
            await collection.createIndex({ uid: 1 }, { unique: true });
            await collection.createIndex({ email: 1 }, { unique: true });
            await collection.createIndex({ createdAt: 1 });
            await collection.createIndex({ lastLoginAt: 1 });

            logger.info('User collection indexes created successfully');
        } catch (error) {
            logger.error('Error creating user indexes:', error);
            throw error;
        }
    }
}

module.exports = new User();