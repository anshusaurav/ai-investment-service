const { LRUCache } = require('lru-cache');
const logger = require('../utils/logger');

class MemoryCache {
    constructor() {
        // Configure LRU cache with reasonable defaults
        this.cache = new LRUCache({
            max: 10000, // Maximum 10k items
            maxSize: 50 * 1024 * 1024, // 50MB max cache size
            sizeCalculation: (value) => {
                // Rough estimate of object size
                return JSON.stringify(value).length;
            },
            ttl: 1000 * 60 * 5, // 5 minutes default TTL
            allowStale: false,
            updateAgeOnGet: true,
            updateAgeOnHas: false,
        });

        logger.info('Memory cache initialized');
    }

    get(key) {
        try {
            const value = this.cache.get(key);
            if (value !== undefined) {
                logger.debug(`Memory cache hit for key: ${key}`);
                return value;
            }
            logger.debug(`Memory cache miss for key: ${key}`);
            return null;
        } catch (error) {
            logger.error(`Memory cache GET error for key ${key}:`, error);
            return null;
        }
    }

    set(key, value, ttlSeconds = 300) {
        try {
            this.cache.set(key, value, { ttl: ttlSeconds * 1000 });
            logger.debug(`Memory cache set for key: ${key}`);
            return true;
        } catch (error) {
            logger.error(`Memory cache SET error for key ${key}:`, error);
            return false;
        }
    }

    del(key) {
        try {
            this.cache.delete(key);
            logger.debug(`Memory cache deleted for key: ${key}`);
            return true;
        } catch (error) {
            logger.error(`Memory cache DEL error for key ${key}:`, error);
            return false;
        }
    }

    clear() {
        try {
            this.cache.clear();
            logger.info('Memory cache cleared');
            return true;
        } catch (error) {
            logger.error('Memory cache CLEAR error:', error);
            return false;
        }
    }

    // Helper method for cache key generation
    getCachedData(keyPrefix, identifier) {
        const key = `${keyPrefix}:${identifier}`;
        return this.get(key);
    }

    cacheData(keyPrefix, identifier, data, ttlSeconds = 300) {
        const key = `${keyPrefix}:${identifier}`;
        return this.set(key, data, ttlSeconds);
    }

    invalidateCache(keyPrefix, identifier = '*') {
        try {
            if (identifier === '*') {
                // Clear all keys with this prefix
                const pattern = `${keyPrefix}:`;
                let deletedCount = 0;

                for (const key of this.cache.keys()) {
                    if (key.startsWith(pattern)) {
                        this.cache.delete(key);
                        deletedCount++;
                    }
                }

                logger.info(`Memory cache invalidated ${deletedCount} keys with prefix: ${keyPrefix}`);
            } else {
                const key = `${keyPrefix}:${identifier}`;
                this.cache.delete(key);
                logger.debug(`Memory cache invalidated for key: ${key}`);
            }
            return true;
        } catch (error) {
            logger.error(`Memory cache invalidation error for ${keyPrefix}:`, error);
            return false;
        }
    }

    getStats() {
        return {
            size: this.cache.size,
            max: this.cache.max,
            calculatedSize: this.cache.calculatedSize,
            maxSize: this.cache.maxSize,
        };
    }
}

module.exports = new MemoryCache();