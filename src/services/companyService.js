const { collections } = require("../config/firestore");
const logger = require("../utils/logger");

class CompanyService {
  /**
   * Get company details by ID from documents collection
   * @param {string} companyId - Company ID to search for
   * @returns {Promise<Object|null>} Company data or null if not found
   */
  async   getCompanyById(companyId) {
    try {
      logger.info(`Fetching company details for ID: ${companyId}`);

      // Query the documents collection for company data
      const querySnapshot = await collections.documents
        .where("companyCode", "==", companyId)
        .limit(10)
        .get();

      if (querySnapshot.empty) {
        logger.warn(`No company found with ID: ${companyId}`);
        return null;
      }
      const docs = querySnapshot.docs;
      // const docWithMaxMarkdownConcalls = docs.reduce((maxDoc, currentDoc) => {
      //     const currentConcallsWithMarkdown = (currentDoc.data().Concalls || []).filter(concall => concall.markdownOutput).length;
      //     const maxConcallsWithMarkdown = (maxDoc?.data().Concalls || []).filter(concall => concall.markdownOutput).length;
      //     return currentConcallsWithMarkdown > maxConcallsWithMarkdown ? currentDoc : maxDoc;
      // }, docs[0]);

      const doc = docs?.[0];
      const companyData = {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      };

      logger.info(
        `Company details retrieved successfully for ID: ${companyId}`
      );
      return companyData;
    } catch (error) {
      logger.error("Failed to get company details:", {
        error: error.message,
        companyId,
      });
      throw error;
    }
  }

  /**
   * Get company details by multiple criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Array of company documents
   */
  async getCompaniesByCriteria(criteria) {
    try {
      logger.info("Fetching companies by criteria:", criteria);

      let query = collections.documents.where("type", "==", "company");

      // Apply additional filters based on criteria
      if (criteria.status) {
        query = query.where("status", "==", criteria.status);
      }

      if (criteria.industry) {
        query = query.where("industry", "==", criteria.industry);
      }

      if (criteria.location) {
        query = query.where("location", "==", criteria.location);
      }

      if (criteria.size) {
        query = query.where("size", "==", criteria.size);
      }

      // Apply limit
      const limit = criteria.limit || 10;
      query = query.limit(limit);

      const querySnapshot = await query.get();

      if (querySnapshot.empty) {
        logger.warn("No companies found matching criteria");
        return [];
      }

      const companies = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      }));

      logger.info(`Found ${companies.length} companies matching criteria`);
      return companies;
    } catch (error) {
      logger.error("Failed to get companies by criteria:", {
        error: error.message,
        criteria,
      });
      throw error;
    }
  }

  /**
   * Get company details by name
   * @param {string} companyName - Company name to search for
   * @returns {Promise<Object|null>} Company data or null if not found
   */
  async getCompanyByName(companyName) {
    try {
      logger.info(`Fetching company details for name: ${companyName}`);

      const querySnapshot = await collections.documents
        .where("type", "==", "company")
        .where("name", "==", companyName)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        logger.warn(`No company found with name: ${companyName}`);
        return null;
      }

      const doc = querySnapshot.docs[0];
      const companyData = {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      };

      logger.info(
        `Company details retrieved successfully for name: ${companyName}`
      );
      return companyData;
    } catch (error) {
      logger.error("Failed to get company details by name:", {
        error: error.message,
        companyName,
      });
      throw error;
    }
  }

  /**
   * Get company details by industry path
   * @param {string} industryPath - Company name to search for
   * @returns {Promise<Object|null>} Company data or null if not found
   */
  async getCompanyByIndustry(industryPath) {
    try {
      logger.info(`Fetching companies with industries path: ${industryPath}`);

      // First attempt: Exact match
      console.log('Service - Attempting exact match for:', industryPath);
      let snapshot = await collections.documents
          .where("industryLink", "==", industryPath)
          .limit(100)
          .get();

      console.log('Service - Exact match results:', snapshot);

      // If no exact match found, try prefix match
      if (snapshot.empty) {
        logger.info(`No exact match found for ${industryPath}, attempting prefix match`);
        console.log('Service - Attempting prefix match for:', industryPath);

        // For prefix matching, we need to use range queries
        // This will match all documents where industryLink starts with the given path
        const prefixEnd = industryPath.slice(0, -1) + String.fromCharCode(industryPath.charCodeAt(industryPath.length - 1) + 1);

        snapshot = await collections.documents
            .where("industryLink", ">=", industryPath)
            .where("industryLink", "<", prefixEnd)
            .limit(100)
            .get();

        console.log('Service - Prefix match results:', snapshot);
      }

      if (snapshot.empty) {
        logger.warn(`No company found with industries path (exact or prefix): ${industryPath}`);
        return null;
      }

      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        companyCode: doc.data().companyCode,
      }));

      logger.info(`Found ${results.length} companies for industries path: ${industryPath}`);
      return results;

    } catch (error) {
      logger.error("Failed to get companies details by industries path:", {
        error: error.message,
        industryPath,
      });
      throw error;
    }
  }

  /**
   * Search companies by text query
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching companies
   */
  async searchCompanies(searchTerm) {
    try {
      logger.info(`Searching companies with term: ${searchTerm}`);

      // Note: Firestore doesn't support full-text search natively
      // This is a basic implementation using array-contains for keywords
      // const querySnapshot = await collections.documents
      const querySnapshot = await collections.documents
          .where('name', '>=', searchTerm.toLowerCase())
          .where('name', '<', searchTerm.toLowerCase() + '\uf8ff')
          .get();

      const companies = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        companyCode: doc.data().companyCode,
        name: doc.data().name,
        nseCode: doc.data().nseCode,
        bseCode: doc.data().bseCode,
      }));
      console.log(companies);

      logger.info(`Found ${companies.length} companies matching search term`);
      return companies;
    } catch (error) {
      logger.error("Failed to search companies:", {
        error: error.message,
        searchTerm,
      });
      throw error;
    }
  }

  /**
   * Get company statistics
   * @returns {Promise<Object>} Company statistics
   */
  async getCompanyStats() {
    try {
      logger.info("Fetching company statistics");

      const querySnapshot = await collections.documents
        .where("type", "==", "company")
        .get();

      let totalCompanies = 0;
      let activeCompanies = 0;
      let inactiveCompanies = 0;
      const industries = {};
      const locations = {};

      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        totalCompanies++;

        if (data.status === "active") {
          activeCompanies++;
        } else {
          inactiveCompanies++;
        }

        // Count by industry
        if (data.industry) {
          industries[data.industry] = (industries[data.industry] || 0) + 1;
        }

        // Count by location
        if (data.location) {
          locations[data.location] = (locations[data.location] || 0) + 1;
        }
      });

      const stats = {
        totalCompanies,
        activeCompanies,
        inactiveCompanies,
        industries,
        locations,
      };

      logger.info("Company statistics retrieved successfully");
      return stats;
    } catch (error) {
      logger.error("Failed to get company statistics:", error);
      throw error;
    }
  }
}

module.exports = new CompanyService();
