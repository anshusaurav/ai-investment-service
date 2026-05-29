const { collections } = require("../config/firestore");
const mongodb = require("../config/mongodb");
const redis = require("../config/redis");
const memoryCache = require("../config/memoryCache");
const logger = require("../utils/logger");

// ─── Internal-field stripping ─────────────────────────────────────────────────

/** Fields on the top-level company document that are pipeline-internal only */
const TOP_LEVEL_STRIP = new Set([
  'lastProcessed',
  'trackerGeneratedAt',
  'rawDocuments',   // safety net — should have been removed by DocumentCleaner
]);

/** Fields on individual Concall objects that are pipeline-internal only */
const CONCALL_STRIP = new Set([
  'isGuidanceTableStandardized',
  'guidanceTableStandardizedDate',
  'guidanceTableStandardizationNote',
  'guidanceTableStandardizationError',
  'processingError',
  'processingDate',
  'textLength',
]);

/**
 * Extract a plain display value from an insights cell.
 * The scraper stores values as either a plain string/number OR an object
 * { value: "1,234", dateKey: "2024-03-31", sourceLink: "https://..." }.
 * We only expose the display string to the frontend.
 */
function extractInsightValue(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') return raw.value ?? null;
  return raw;
}

/**
 * Clean an insights object before sending to the frontend:
 *   - Period objects: keep only { label }
 *   - Row values: unwrap from { value, dateKey, sourceLink } → plain string
 */
function transformInsights(insights) {
  if (!insights || typeof insights !== 'object') return insights;
  const result = {};
  for (const [tab, tabData] of Object.entries(insights)) {
    if (!tabData) { result[tab] = tabData; continue; }
    result[tab] = {
      periods: (tabData.periods || []).map(p => ({ label: p.label })),
      rows: (tabData.rows || []).map(row => ({
        metric: row.metric,
        ...(row.unit !== undefined && row.unit !== null ? { unit: row.unit } : {}),
        values: Object.fromEntries(
          Object.entries(row.values || {}).map(([period, val]) => [
            period,
            extractInsightValue(val),
          ])
        ),
      })),
    };
  }
  return result;
}

/**
 * Parse a quarter string like "Q4FY26" / "Q4 FY26" into a sortable object.
 * Returns { fy: 0, qNum: 0 } for unrecognised formats (they sort to the end).
 */
function parseQuarterForSort(quarter) {
  if (!quarter) return { fy: 0, qNum: 0 };
  const match = quarter.match(/Q(\d+)\s*FY(\d+)/i);
  if (match) return { fy: parseInt(match[2], 10), qNum: parseInt(match[1], 10) };
  return { fy: 0, qNum: 0 };
}

/**
 * Strip pipeline-internal fields from a raw Firestore company document and
 * return a clean object safe to send to the frontend.
 * The `insights` field is intentionally NOT cleaned here — callers that have
 * already determined the user is premium should call transformInsights() on
 * responseData.insights separately (done in the controller).
 */
function transformCompanyData(raw) {
  if (!raw) return raw;

  // 1. Strip internal top-level fields
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([k]) => !TOP_LEVEL_STRIP.has(k))
  );

  // 2. Strip internal fields from each Concall and sort newest-first
  if (cleaned.documents?.Concalls) {
    cleaned.documents = {
      ...cleaned.documents,
      Concalls: cleaned.documents.Concalls
        .map(concall =>
          Object.fromEntries(
            Object.entries(concall).filter(([k]) => !CONCALL_STRIP.has(k))
          )
        )
        .sort((a, b) => {
          const pa = parseQuarterForSort(a.quarter);
          const pb = parseQuarterForSort(b.quarter);
          if (pb.fy !== pa.fy) return pb.fy - pa.fy;
          return pb.qNum - pa.qNum;
        }),
    };
  }

  // 3. Clean insights (unwrap value objects, strip period metadata)
  if (cleaned.insights) {
    cleaned.insights = transformInsights(cleaned.insights);
  }

  return cleaned;
}

class CompanyService {
  /**
   * Get company details by ID from documents collection
   * @param {string} companyId - Company ID to search for
   * @returns {Promise<Object|null>} Company data or null if not found
   */
  async getCompanyById(companyId) {
    try {
      logger.info(`Fetching company details for ID: ${companyId}`);

      // L1: Check in-memory cache first (fastest - ~1ms)
      const memoryCachedData = memoryCache.getCachedData('company', companyId);
      if (memoryCachedData) {
        logger.info(`Company details retrieved from memory cache for ID: ${companyId}`);
        return memoryCachedData;
      }

      // L2: Check Redis cache (fast - ~10-50ms)
      const redisCachedData = await redis.getCachedData('company', companyId);
      if (redisCachedData) {
        logger.info(`Company details retrieved from Redis cache for ID: ${companyId}`);
        // Populate memory cache for next request
        memoryCache.cacheData('company', companyId, redisCachedData, 300);
        return redisCachedData;
      }

      // L3: Query the documents collection for company data (slowest - ~100ms+)
      const querySnapshot = await collections.documents
        .where("companyCode", "==", companyId)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        logger.warn(`No company found with ID: ${companyId}`);
        return null;
      }

      const doc = querySnapshot.docs[0];
      const raw = {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      };

      // Strip pipeline-internal fields and clean insights value format
      const companyData = transformCompanyData(raw);

      // Cache in both layers (don't await Redis - fire and forget)
      memoryCache.cacheData('company', companyId, companyData, 300); // 5 minutes in memory
      redis.cacheData('company', companyId, companyData, 3600).catch(err =>
        logger.error('Failed to cache company data in Redis:', err)
      );

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
        .where("name", "==", companyName)
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

      // Check Redis cache first
      const cachedData = await redis.getCachedData('industry', industryPath);
      if (cachedData) {
        logger.info(`Industry companies retrieved from cache for path: ${industryPath}`);
        return cachedData;
      }

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
        nseCode: doc.data().nseCode || null,
        bseCode: doc.data().bseCode || null,
      }));

      // Deduplicate by companyCode to avoid returning the same company multiple times
      const uniqueResults = [];
      const seenCompanyCodes = new Set();

      for (const result of results) {
        if (!seenCompanyCodes.has(result.companyCode)) {
          seenCompanyCodes.add(result.companyCode);
          uniqueResults.push(result);
        }
      }

      // Cache the results for 30 minutes
      await redis.cacheData('industry', industryPath, uniqueResults, 1800);

      logger.info(`Found ${uniqueResults.length} unique companies for industries path: ${industryPath}`);
      return uniqueResults;

    } catch (error) {
      logger.error("Failed to get companies details by industries path:", {
        error: error.message,
        industryPath,
      });
      throw error;
    }
  }

  /**
   * Search companies by text query using Atlas Search
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching companies
   */
  async searchCompanies(searchTerm) {
    try {
      logger.info(`Searching companies with term: ${searchTerm}`);

      // Check Redis cache first (cache search results for 10 minutes)
      const cacheKey = `search:${searchTerm.toLowerCase()}`;
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        logger.info(`Search results retrieved from cache for term: ${searchTerm}`);
        return cachedData;
      }

      // Ensure MongoDB is connected before querying
      if (!mongodb.isConnected) {
        await mongodb.connect();
      }
      const collection = mongodb.getCollection();

      // Use Atlas Search for optimized search performance
      const companies = await collection.aggregate([
        {
          $search: {
            index: "text-search",
            compound: {
              should: [
                // Boost exact prefix matches on codes (highest priority)
                {
                  autocomplete: {
                    query: searchTerm,
                    path: "companyCode",
                    score: { boost: { value: 10 } }
                  }
                },
                {
                  autocomplete: {
                    query: searchTerm,
                    path: "nseCode",
                    score: { boost: { value: 10 } }
                  }
                },
                {
                  autocomplete: {
                    query: searchTerm,
                    path: "bseCode",
                    score: { boost: { value: 10 } }
                  }
                },
                // Text match on name with fuzzy support
                {
                  text: {
                    query: searchTerm,
                    path: "name",
                    fuzzy: { maxEdits: 1 },
                    score: { boost: { value: 5 } }
                  }
                }
              ],
              minimumShouldMatch: 1
            }
          }
        },
        {
          $project: {
            name: 1,
            companyCode: 1,
            nseCode: 1,
            bseCode: 1,
            score: { $meta: "searchScore" }
          }
        },
        { $limit: 50 }
      ]).toArray();

      // Transform to return only required fields
      const transformedCompanies = companies.map(({ name, companyCode, nseCode, bseCode }) => ({
        name,
        companyCode,
        nseCode,
        bseCode
      }));

      // Cache search results for 10 minutes
      await redis.set(cacheKey, transformedCompanies, 600);

      logger.info(`Found ${transformedCompanies.length} companies matching search term`);
      return transformedCompanies;
    } catch (error) {
      logger.error("Failed to search companies:", {
        error: error.message,
        searchTerm,
      });
      throw error;
    }
  }

  /**
   * Get industry lists with caching
   * @returns {Promise<Array>} Array of industries
   */
  async getIndustryList() {
    try {
      logger.info("Fetching industry list");

      // Check Redis cache first
      const cachedData = await redis.getCachedData('industries', 'list');
      if (cachedData) {
        logger.info("Industry list retrieved from cache");
        return cachedData;
      }

      // Ensure MongoDB is connected before querying
      if (!mongodb.isConnected) {
        await mongodb.connect();
      }
      const collection = mongodb.getCollection();

      // Get distinct industries from the companies collection
      const industries = await collection.distinct('industry', {
        industry: { $exists: true, $ne: null, $ne: "" }
      });

      // Sort industries alphabetically
      const sortedIndustries = industries.sort();

      // Cache for 2 hours
      await redis.cacheData('industries', 'list', sortedIndustries, 7200);

      logger.info(`Found ${sortedIndustries.length} unique industries`);
      return sortedIndustries;
    } catch (error) {
      logger.error("Failed to get industry list:", error);
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

      // Check Redis cache first
      const cachedData = await redis.getCachedData('stats', 'company');
      if (cachedData) {
        logger.info("Company statistics retrieved from cache");
        return cachedData;
      }

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

      // Cache stats for 1 hour
      await redis.cacheData('stats', 'company', stats, 3600);

      logger.info("Company statistics retrieved successfully");
      return stats;
    } catch (error) {
      logger.error("Failed to get company statistics:", error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific company
   * @param {string} companyId - Company ID
   */
  async clearCompanyCache(companyId) {
    try {
      // Clear from both memory and Redis cache
      memoryCache.invalidateCache('company', companyId);
      await redis.invalidateCache('company', companyId);
      logger.info(`Cache cleared for company: ${companyId}`);
    } catch (error) {
      logger.error(`Failed to clear cache for company ${companyId}:`, error);
    }
  }

  /**
   * Clear all company-related caches
   */
  async clearAllCache() {
    try {
      // Clear from both memory and Redis cache
      memoryCache.invalidateCache('company', '*');
      memoryCache.invalidateCache('industry', '*');
      memoryCache.invalidateCache('stats', '*');
      memoryCache.invalidateCache('industries', '*');

      await redis.invalidateCache('company', '*');
      await redis.invalidateCache('industry', '*');
      await redis.invalidateCache('stats', '*');
      await redis.invalidateCache('industries', '*');
      logger.info("All company-related caches cleared");
    } catch (error) {
      logger.error("Failed to clear all caches:", error);
    }
  }
}

module.exports = new CompanyService();
