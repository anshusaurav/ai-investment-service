const mongodb = require('../config/mongodb');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const LIMIT = 10;

function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

class UsageService {
    /**
     * Get the current month's usage for a user.
     * Returns { guidance: [...], concalls: [...], month } — always an object, never null.
     */
    async getUsage(userId) {
        try {
            // Try Redis cache first (short TTL — usage changes often)
            const cached = await redis.getCachedData('usage', `${userId}:${currentMonth()}`);
            if (cached) return cached;

            if (!mongodb.isConnected) await mongodb.connect();
            const collection = mongodb.getCollection('usage');
            const month = currentMonth();

            const doc = await collection.findOne({ userId, month });

            const result = {
                month,
                guidance: doc?.guidance || [],
                concalls: doc?.concalls || [],
            };

            // Cache for 2 minutes
            await redis.cacheData('usage', `${userId}:${month}`, result, 120);

            return result;
        } catch (error) {
            logger.error('UsageService.getUsage failed:', { error: error.message, userId });
            // Graceful fallback — return empty so the app doesn't break
            return { month: currentMonth(), guidance: [], concalls: [] };
        }
    }

    /**
     * Track a guidance view. Idempotent — adding the same companyCode twice is a no-op.
     * Throws with code USAGE_LIMIT_REACHED for free users who are over the limit.
     */
    async trackGuidanceView(userId, companyCode, isPremium) {
        try {
            const current = await this.getUsage(userId);

            // Already tracked — no-op, return current state
            if (current.guidance.includes(companyCode)) {
                return { ...current, alreadyTracked: true };
            }

            // Enforce limit for free users
            if (!isPremium && current.guidance.length >= LIMIT) {
                const err = new Error(
                    `Free plan limit reached. Upgrade to Premium to track more than ${LIMIT} companies per month.`
                );
                err.code = 'USAGE_LIMIT_REACHED';
                throw err;
            }

            if (!mongodb.isConnected) await mongodb.connect();
            const collection = mongodb.getCollection('usage');
            const month = currentMonth();

            await collection.updateOne(
                { userId, month },
                {
                    $addToSet: { guidance: companyCode },
                    $setOnInsert: { userId, month, concalls: [], createdAt: new Date() },
                    $set: { updatedAt: new Date() },
                },
                { upsert: true }
            );

            // Bust cache so next getUsage is fresh
            await redis.invalidateCache('usage', `${userId}:${month}`);

            logger.info(`Guidance view tracked for user ${userId}: company ${companyCode}`);
            return await this.getUsage(userId);
        } catch (error) {
            logger.error('UsageService.trackGuidanceView failed:', {
                error: error.message,
                userId,
                companyCode,
            });
            throw error;
        }
    }

    /**
     * Track a concall summary view. Idempotent.
     * Throws with code USAGE_LIMIT_REACHED for free users who are over the limit.
     */
    async trackConcallView(userId, concallId, isPremium) {
        try {
            const current = await this.getUsage(userId);

            if (current.concalls.includes(concallId)) {
                return { ...current, alreadyTracked: true };
            }

            if (!isPremium && current.concalls.length >= LIMIT) {
                const err = new Error(
                    `Free plan limit reached. Upgrade to Premium for unlimited conference call summaries.`
                );
                err.code = 'USAGE_LIMIT_REACHED';
                throw err;
            }

            if (!mongodb.isConnected) await mongodb.connect();
            const collection = mongodb.getCollection('usage');
            const month = currentMonth();

            await collection.updateOne(
                { userId, month },
                {
                    $addToSet: { concalls: concallId },
                    $setOnInsert: { userId, month, guidance: [], createdAt: new Date() },
                    $set: { updatedAt: new Date() },
                },
                { upsert: true }
            );

            await redis.invalidateCache('usage', `${userId}:${month}`);

            logger.info(`Concall view tracked for user ${userId}: concall ${concallId}`);
            return await this.getUsage(userId);
        } catch (error) {
            logger.error('UsageService.trackConcallView failed:', {
                error: error.message,
                userId,
                concallId,
            });
            throw error;
        }
    }

    /**
     * Reset current month's usage to zero (useful for testing / admin).
     */
    async resetUsage(userId) {
        try {
            if (!mongodb.isConnected) await mongodb.connect();
            const collection = mongodb.getCollection('usage');
            const month = currentMonth();

            await collection.updateOne(
                { userId, month },
                {
                    $set: { guidance: [], concalls: [], updatedAt: new Date() },
                    $setOnInsert: { userId, month, createdAt: new Date() },
                },
                { upsert: true }
            );

            await redis.invalidateCache('usage', `${userId}:${month}`);

            logger.info(`Usage reset for user ${userId}`);
            return { month, guidance: [], concalls: [] };
        } catch (error) {
            logger.error('UsageService.resetUsage failed:', { error: error.message, userId });
            throw error;
        }
    }
}

module.exports = new UsageService();
