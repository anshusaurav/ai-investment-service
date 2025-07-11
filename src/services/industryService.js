const admin = require('firebase-admin');
const logger = require('../utils/logger');

class IndustryService {
    constructor() {
        this.collection = admin.firestore().collection('industryPrompts');
    }

    /**
     * Get all industries
     * @returns {Promise<Array>} Array of industries
     */
    async getAllIndustries() {
        try {
            const snapshot = await this.collection.get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            logger.error('Error in getAllIndustries service:', error);
            throw error;
        }
    }

    /**
     * Get industry by ID
     * @param {string} id - Industry ID
     * @returns {Promise<Object|null>} Industry object or null if not found
     */
    async getIndustryById(id) {
        try {
            const doc = await this.collection.doc(id).get();
            if (!doc.exists) {
                return null;
            }
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            logger.error('Error in getIndustryById service:', error);
            throw error;
        }
    }

    /**
     * Search industries by name
     * @param {string} query - Search query
     * @returns {Promise<Array>} Array of matching industries
     */
    async searchIndustries(query) {
        try {
            const searchQuery = query.toLowerCase();
            const snapshot = await this.collection
                .orderBy('name')
                .get();

            return snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(industry =>
                    industry.name.toLowerCase().includes(searchQuery) ||
                    (industry.description && industry.description.toLowerCase().includes(searchQuery))
                );
        } catch (error) {
            logger.error('Error in searchIndustries service:', error);
            throw error;
        }
    }

    /**
     * Get industry statistics
     * @returns {Promise<Object>} Industry statistics
     */
    async getIndustryStats() {
        try {
            const snapshot = await this.collection.get();
            const industries = snapshot.docs.map(doc => doc.data());

            return {
                totalCount: industries.length,
                // Add more statistics as needed
                // For example:
                // activeCount: industries.filter(i => i.status === 'active').length,
                // categoryBreakdown: this.getCategoryBreakdown(industries)
            };
        } catch (error) {
            logger.error('Error in getIndustryStats service:', error);
            throw error;
        }
    }
}

module.exports = new IndustryService();