const mongodb = require('../config/mongodb');
const logger = require('../utils/logger');

/**
 * Setup MongoDB indexes for optimal search performance
 * Run this script once to create the necessary indexes
 */
async function setupIndexes() {
  try {
    logger.info('Starting index setup for MongoDB...');

    // Connect to MongoDB
    await mongodb.connect();
    const collection = mongodb.getCollection();

    // Create text index for full-text search on name
    // This enables fast, case-insensitive text search
    await collection.createIndex(
      { name: 'text' },
      {
        name: 'name_text_index',
        default_language: 'english',
        weights: { name: 10 } // Higher weight for name field
      }
    );
    logger.info('✓ Created text index on name field');

    // Create individual indexes for exact/prefix matching
    await collection.createIndex(
      { companyCode: 1 },
      { name: 'companyCode_index' }
    );
    logger.info('✓ Created index on companyCode field');

    await collection.createIndex(
      { nseCode: 1 },
      { name: 'nseCode_index', sparse: true }
    );
    logger.info('✓ Created index on nseCode field');

    await collection.createIndex(
      { bseCode: 1 },
      { name: 'bseCode_index', sparse: true }
    );
    logger.info('✓ Created index on bseCode field');

    // Compound index for common query patterns
    await collection.createIndex(
      { name: 1, companyCode: 1 },
      { name: 'name_companyCode_compound' }
    );
    logger.info('✓ Created compound index on name and companyCode');

    // List all indexes to verify
    const indexes = await collection.indexes();
    logger.info('All indexes on collection:');
    indexes.forEach(index => {
      logger.info(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    logger.info('✓ Index setup completed successfully!');

    await mongodb.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to setup indexes:', error);
    process.exit(1);
  }
}

// Run the setup
setupIndexes();