const { createClient } = require('redis');
const logger = require('../utils/logger');

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            if (this.isConnected && this.client) {
                return this.client;
            }

            const redisConfig = {
                username: process.env.REDIS_USER || 'default',
                password: process.env.REDIS_PASSWORD,
                socket: {
                    host: process.env.REDIS_HOST,
                    port: parseInt(process.env.REDIS_PORT) || 6379,
                    connectTimeout: 10000,
                    lazyConnect: true
                },
                retry_unfulfilled_commands: true,
                retry_delay_on_failover: 100,
                enable_offline_queue: false
            };

            if (!redisConfig.password || !redisConfig.socket.host) {
                logger.warn('Redis configuration incomplete, skipping Redis connection');
                return null;
            }

            this.client = createClient(redisConfig);

            this.client.on('error', (err) => {
                logger.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                logger.info('Redis client connected');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                logger.info('Redis client ready');
            });

            this.client.on('end', () => {
                logger.info('Redis client disconnected');
                this.isConnected = false;
            });

            await this.client.connect();

            // Test the connection
            await this.client.ping();
            logger.info('Redis connection established successfully');

            return this.client;
        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
            this.isConnected = false;
            return null;
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.quit();
                this.isConnected = false;
                logger.info('Redis client disconnected');
            }
        } catch (error) {
            logger.error('Error disconnecting from Redis:', error);
        }
    }

    async get(key) {
        try {
            if (!this.isConnected || !this.client) {
                return null;
            }
            const result = await this.client.get(key);
            return result ? JSON.parse(result) : null;
        } catch (error) {
            logger.error(`Redis GET error for key ${key}:`, error);
            return null;
        }
    }

    async set(key, value, ttlSeconds = 3600) {
        try {
            if (!this.isConnected || !this.client) {
                return false;
            }
            await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error(`Redis SET error for key ${key}:`, error);
            return false;
        }
    }

    async del(key) {
        try {
            if (!this.isConnected || !this.client) {
                return false;
            }
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error(`Redis DEL error for key ${key}:`, error);
            return false;
        }
    }

    async exists(key) {
        try {
            if (!this.isConnected || !this.client) {
                return false;
            }
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            logger.error(`Redis EXISTS error for key ${key}:`, error);
            return false;
        }
    }

    // Cache with automatic key generation
    async cacheData(keyPrefix, identifier, data, ttlSeconds = 3600) {
        const key = `${keyPrefix}:${identifier}`;
        return await this.set(key, data, ttlSeconds);
    }

    async getCachedData(keyPrefix, identifier) {
        const key = `${keyPrefix}:${identifier}`;
        return await this.get(key);
    }

    async invalidateCache(keyPrefix, identifier = '*') {
        try {
            if (!this.isConnected || !this.client) {
                return false;
            }

            const pattern = `${keyPrefix}:${identifier}`;
            if (identifier === '*') {
                // Delete all keys with this prefix
                const keys = await this.client.keys(pattern);
                if (keys.length > 0) {
                    await this.client.del(keys);
                }
            } else {
                await this.client.del(pattern);
            }
            return true;
        } catch (error) {
            logger.error(`Redis cache invalidation error for ${keyPrefix}:`, error);
            return false;
        }
    }

    isHealthy() {
        return this.isConnected && this.client;
    }
}

module.exports = new RedisClient();