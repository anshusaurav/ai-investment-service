const { admin } = require('../config/firebase');
const logger = require('../utils/logger');

class UserService {
    /**
     * Get user profile by UID
     * @param {string} uid - User ID
     * @returns {Promise<Object>} User profile data
     */
    async getUserProfile(uid) {
        try {
            const userRecord = await admin.auth().getUser(uid);

            logger.info(`User profile retrieved for: ${uid}`);

            return {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                photoURL: userRecord.photoURL,
                emailVerified: userRecord.emailVerified,
                disabled: userRecord.disabled,
                metadata: {
                    creationTime: userRecord.metadata.creationTime,
                    lastSignInTime: userRecord.metadata.lastSignInTime,
                    lastRefreshTime: userRecord.metadata.lastRefreshTime
                },
                customClaims: userRecord.customClaims || {},
                providerData: userRecord.providerData.map(provider => ({
                    uid: provider.uid,
                    email: provider.email,
                    displayName: provider.displayName,
                    photoURL: provider.photoURL,
                    providerId: provider.providerId
                }))
            };
        } catch (error) {
            logger.error('Failed to get user profile:', {
                error: error.message,
                uid
            });
            throw error;
        }
    }

    /**
     * Update user profile
     * @param {string} uid - User ID
     * @param {Object} updates - Profile updates
     * @returns {Promise<Object>} Updated user profile
     */
    async updateUserProfile(uid, updates) {
        try {
            const userRecord = await admin.auth().updateUser(uid, updates);

            logger.info(`User profile updated for: ${uid}`, updates);

            return this.getUserProfile(uid);
        } catch (error) {
            logger.error('Failed to update user profile:', {
                error: error.message,
                uid,
                updates
            });
            throw error;
        }
    }

    /**
     * Set custom claims for user
     * @param {string} uid - User ID
     * @param {Object} customClaims - Custom claims to set
     * @returns {Promise<void>}
     */
    async setCustomClaims(uid, customClaims) {
        try {
            await admin.auth().setCustomUserClaims(uid, customClaims);
            logger.info(`Custom claims set for user: ${uid}`, customClaims);
        } catch (error) {
            logger.error('Failed to set custom claims:', {
                error: error.message,
                uid,
                customClaims
            });
            throw error;
        }
    }

    /**
     * Delete user account
     * @param {string} uid - User ID
     * @returns {Promise<void>}
     */
    async deleteUser(uid) {
        try {
            await admin.auth().deleteUser(uid);
            logger.info(`User deleted: ${uid}`);
        } catch (error) {
            logger.error('Failed to delete user:', {
                error: error.message,
                uid
            });
            throw error;
        }
    }

    /**
     * Disable user account
     * @param {string} uid - User ID
     * @returns {Promise<void>}
     */
    async disableUser(uid) {
        try {
            await admin.auth().updateUser(uid, { disabled: true });
            logger.info(`User disabled: ${uid}`);
        } catch (error) {
            logger.error('Failed to disable user:', {
                error: error.message,
                uid
            });
            throw error;
        }
    }

    /**
     * Enable user account
     * @param {string} uid - User ID
     * @returns {Promise<void>}
     */
    async enableUser(uid) {
        try {
            await admin.auth().updateUser(uid, { disabled: false });
            logger.info(`User enabled: ${uid}`);
        } catch (error) {
            logger.error('Failed to enable user:', {
                error: error.message,
                uid
            });
            throw error;
        }
    }

    /**
     * List users with pagination
     * @param {number} maxResults - Maximum number of results
     * @param {string} nextPageToken - Token for next page
     * @returns {Promise<Object>} List of users and pagination info
     */
    async listUsers(maxResults = 1000, nextPageToken = null) {
        try {
            const listUsersResult = await admin.auth().listUsers(maxResults, nextPageToken);

            logger.info(`Listed ${listUsersResult.users.length} users`);

            return {
                users: listUsersResult.users.map(user => ({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified,
                    disabled: user.disabled,
                    metadata: {
                        creationTime: user.metadata.creationTime,
                        lastSignInTime: user.metadata.lastSignInTime
                    }
                })),
                pageToken: listUsersResult.pageToken
            };
        } catch (error) {
            logger.error('Failed to list users:', {
                error: error.message,
                maxResults,
                nextPageToken
            });
            throw error;
        }
    }
}

module.exports = new UserService();