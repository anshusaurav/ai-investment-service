const mongodb = require('../config/mongodb');
const redis = require('../config/redis');
const logger = require('../utils/logger');

class WatchlistService {
    /**
     * Get user's watchlist
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Array of company codes
     */
    async getUserWatchlist(userId) {
        try {
            logger.info(`Fetching watchlist for user: ${userId}`);

            // Check Redis cache first
            const cachedWatchlist = await redis.getCachedData('watchlist', userId);
            if (cachedWatchlist) {
                logger.info(`Watchlist retrieved from cache for user: ${userId}`);
                return cachedWatchlist;
            }

            // Connect to MongoDB if not already connected
            if (!mongodb.isConnected) {
                await mongodb.connect();
            }
            const collection = mongodb.getCollection('watchlists');

            // Find user's watchlist
            const watchlistDoc = await collection.findOne({ userId });

            const companyCodes = watchlistDoc ? watchlistDoc.companyCodes || [] : [];

            // Cache the watchlist for 30 minutes
            await redis.cacheData('watchlist', userId, companyCodes, 1800);

            logger.info(`Found ${companyCodes.length} companies in watchlist for user: ${userId}`);
            return companyCodes;
        } catch (error) {
            logger.error('Failed to get user watchlist:', {
                error: error.message,
                userId
            });
            throw error;
        }
    }

    /**
     * Add company to user's watchlist
     * @param {string} userId - User ID
     * @param {string} companyCode - Company code to add
     * @returns {Promise<Object>} Updated watchlist
     */
    async followCompany(userId, companyCode) {
        try {
            logger.info(`Adding company ${companyCode} to watchlist for user: ${userId}`);

            // Connect to MongoDB if not already connected
            if (!mongodb.isConnected) {
                await mongodb.connect();
            }
            const collection = mongodb.getCollection('watchlists');

            // Use upsert to create document if it doesn't exist
            const result = await collection.updateOne(
                { userId },
                {
                    $addToSet: { companyCodes: companyCode }, // $addToSet prevents duplicates
                    $setOnInsert: {
                        userId,
                        createdAt: new Date()
                    },
                    $set: { updatedAt: new Date() }
                },
                { upsert: true }
            );

            // Get updated watchlist
            const updatedDoc = await collection.findOne({ userId });
            const companyCodes = updatedDoc.companyCodes || [];

            // Clear cache to ensure fresh data
            await redis.invalidateCache('watchlist', userId);

            logger.info(`Company ${companyCode} added to watchlist for user: ${userId}. Total companies: ${companyCodes.length}`);

            return {
                userId,
                companyCodes,
                totalCompanies: companyCodes.length,
                action: 'followed',
                companyCode
            };
        } catch (error) {
            logger.error('Failed to follow company:', {
                error: error.message,
                userId,
                companyCode
            });
            throw error;
        }
    }

    /**
     * Remove company from user's watchlist
     * @param {string} userId - User ID
     * @param {string} companyCode - Company code to remove
     * @returns {Promise<Object>} Updated watchlist
     */
    async unfollowCompany(userId, companyCode) {
        try {
            logger.info(`Removing company ${companyCode} from watchlist for user: ${userId}`);

            // Connect to MongoDB if not already connected
            if (!mongodb.isConnected) {
                await mongodb.connect();
            }
            const collection = mongodb.getCollection('watchlists');

            // Remove company from array
            const result = await collection.updateOne(
                { userId },
                {
                    $pull: { companyCodes: companyCode },
                    $set: { updatedAt: new Date() }
                }
            );

            if (result.matchedCount === 0) {
                logger.warn(`No watchlist found for user: ${userId}`);
                return {
                    userId,
                    companyCodes: [],
                    totalCompanies: 0,
                    action: 'unfollowed',
                    companyCode,
                    message: 'Watchlist not found'
                };
            }

            // Get updated watchlist
            const updatedDoc = await collection.findOne({ userId });
            const companyCodes = updatedDoc ? updatedDoc.companyCodes || [] : [];

            // Clear cache to ensure fresh data
            await redis.invalidateCache('watchlist', userId);

            logger.info(`Company ${companyCode} removed from watchlist for user: ${userId}. Total companies: ${companyCodes.length}`);

            return {
                userId,
                companyCodes,
                totalCompanies: companyCodes.length,
                action: 'unfollowed',
                companyCode
            };
        } catch (error) {
            logger.error('Failed to unfollow company:', {
                error: error.message,
                userId,
                companyCode
            });
            throw error;
        }
    }

    /**
     * Check if user is following a company
     * @param {string} userId - User ID
     * @param {string} companyCode - Company code to check
     * @returns {Promise<boolean>} True if following, false otherwise
     */
    async isFollowing(userId, companyCode) {
        try {
            const watchlist = await this.getUserWatchlist(userId);
            return watchlist.includes(companyCode);
        } catch (error) {
            logger.error('Failed to check if following company:', {
                error: error.message,
                userId,
                companyCode
            });
            return false;
        }
    }

    /**
     * Get watchlist statistics for user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Watchlist statistics
     */
    async getWatchlistStats(userId) {
        try {
            const companyCodes = await this.getUserWatchlist(userId);

            return {
                userId,
                totalCompanies: companyCodes.length,
                companyCodes
            };
        } catch (error) {
            logger.error('Failed to get watchlist stats:', {
                error: error.message,
                userId
            });
            throw error;
        }
    }

    /**
     * Clear user's entire watchlist
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Result
     */
    async clearWatchlist(userId) {
        try {
            logger.info(`Clearing watchlist for user: ${userId}`);

            // Connect to MongoDB if not already connected
            if (!mongodb.isConnected) {
                await mongodb.connect();
            }
            const collection = mongodb.getCollection('watchlists');

            // Clear the companyCodes array
            const result = await collection.updateOne(
                { userId },
                {
                    $set: {
                        companyCodes: [],
                        updatedAt: new Date()
                    }
                }
            );

            // Clear cache
            await redis.invalidateCache('watchlist', userId);

            logger.info(`Watchlist cleared for user: ${userId}`);

            return {
                userId,
                companyCodes: [],
                totalCompanies: 0,
                action: 'cleared'
            };
        } catch (error) {
            logger.error('Failed to clear watchlist:', {
                error: error.message,
                userId
            });
            throw error;
        }
    }
}

module.exports = new WatchlistService();