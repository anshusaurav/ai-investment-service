const User = require('../models/User');
const logger = require('../utils/logger');

class UserService {
    /**
     * Create a new user in MongoDB
     * @param {Object} userData - User data from Firebase
     * @returns {Promise<Object>} Created user
     */
    async createUser(userData) {
        try {
            // Extract name parts if available
            const nameParts = userData.name ? userData.name.split(' ') : [];
            const firstName = nameParts[0] || null;
            const lastName = nameParts.slice(1).join(' ') || null;

            const userToCreate = {
                uid: userData.uid,
                email: userData.email,
                name: userData.name,
                picture: userData.picture,
                emailVerified: userData.emailVerified,
                provider: userData.provider,
                firstName,
                lastName
            };

            const createdUser = await User.create(userToCreate);
            
            logger.info(`User created in MongoDB: ${userData.uid}`);
            return createdUser;
        } catch (error) {
            logger.error('Error creating user in MongoDB:', error);
            throw error;
        }
    }

    /**
     * Get user by Firebase UID
     * @param {string} uid - Firebase UID
     * @returns {Promise<Object|null>} User data
     */
    async getUserByUid(uid) {
        try {
            const user = await User.findByUid(uid);
            return user;
        } catch (error) {
            logger.error('Error getting user by UID:', error);
            throw error;
        }
    }

    /**
     * Get user by email
     * @param {string} email - User email
     * @returns {Promise<Object|null>} User data
     */
    async getUserByEmail(email) {
        try {
            const user = await User.findByEmail(email);
            return user;
        } catch (error) {
            logger.error('Error getting user by email:', error);
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
            const success = await User.updateLastLogin(uid);
            if (success) {
                logger.info(`Updated last login for user: ${uid}`);
            }
            return success;
        } catch (error) {
            logger.error('Error updating last login:', error);
            throw error;
        }
    }

    /**
     * Update user profile
     * @param {string} uid - Firebase UID
     * @param {Object} profileData - Profile data to update
     * @returns {Promise<Object|null>} Updated user
     */
    async updateUserProfile(uid, profileData) {
        try {
            const updatedUser = await User.updateByUid(uid, profileData);
            if (updatedUser) {
                logger.info(`User profile updated: ${uid}`);
            }
            return updatedUser;
        } catch (error) {
            logger.error('Error updating user profile:', error);
            throw error;
        }
    }

    /**
     * Get user's watchlist
     * @param {string} uid - Firebase UID
     * @returns {Promise<Array>} User's watchlist
     */
    async getUserWatchlist(uid) {
        try {
            const watchlist = await User.getWatchlist(uid);
            return watchlist;
        } catch (error) {
            logger.error('Error getting user watchlist:', error);
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
            const success = await User.addToWatchlist(uid, companyCode);
            if (success) {
                logger.info(`Added ${companyCode} to watchlist for user: ${uid}`);
            }
            return success;
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
            const success = await User.removeFromWatchlist(uid, companyCode);
            if (success) {
                logger.info(`Removed ${companyCode} from watchlist for user: ${uid}`);
            }
            return success;
        } catch (error) {
            logger.error('Error removing from watchlist:', error);
            throw error;
        }
    }

    /**
     * Check if user exists in MongoDB
     * @param {string} uid - Firebase UID
     * @returns {Promise<boolean>} User exists status
     */
    async userExists(uid) {
        try {
            const user = await User.findByUid(uid);
            return !!user;
        } catch (error) {
            logger.error('Error checking if user exists:', error);
            return false;
        }
    }

    /**
     * Initialize user collection indexes
     * @returns {Promise<void>}
     */
    async initializeIndexes() {
        try {
            await User.createIndexes();
            logger.info('User service indexes initialized');
        } catch (error) {
            logger.error('Error initializing user indexes:', error);
            throw error;
        }
    }
}

module.exports = new UserService();