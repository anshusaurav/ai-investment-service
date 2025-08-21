#!/usr/bin/env node

/**
 * Firebase to MongoDB User Migration Script
 * 
 * This script migrates existing Firebase Authentication users to MongoDB
 * Run with: node scripts/migrate-firebase-users.js
 * 
 * Options:
 * --dry-run    : Preview what would be migrated without making changes
 * --batch-size : Number of users to process at once (default: 100)
 * 
 * Example: node scripts/migrate-firebase-users.js --dry-run
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim());
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FIREBASE_PROJECT_ID
        });
    } else {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found in environment variables');
    }
} catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    process.exit(1);
}

// Initialize MongoDB
const { MongoClient } = require('mongodb');
let mongoClient;
let db;

async function connectMongoDB() {
    try {
        const uri = process.env.MONGODB_URI;
        const dbName = process.env.MONGODB_DATABASE;

        if (!uri || !dbName) {
            throw new Error('MongoDB URI and database name must be provided in environment variables');
        }

        mongoClient = new MongoClient(uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,
            tls: true,
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false,
            retryWrites: true,
            w: 'majority'
        });

        await mongoClient.connect();
        db = mongoClient.db(dbName);
        console.log('✅ Connected to MongoDB');
        return db;
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        throw error;
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

console.log('🚀 Firebase to MongoDB User Migration');
console.log('=====================================');
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
console.log(`Batch Size: ${batchSize}`);
console.log('');

/**
 * Map Firebase user data to MongoDB user schema
 */
function mapFirebaseUserToMongoDB(firebaseUser) {
    // Extract name parts
    const displayName = firebaseUser.displayName || '';
    const nameParts = displayName.split(' ');
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(' ') || null;

    // Find Google provider data
    const googleProvider = firebaseUser.providerData.find(p => p.providerId === 'google.com');
    
    return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: displayName,
        picture: firebaseUser.photoURL || null,
        emailVerified: firebaseUser.emailVerified || false,
        provider: 'google.com',
        isActive: !firebaseUser.disabled,
        createdAt: new Date(firebaseUser.metadata.creationTime),
        updatedAt: new Date(firebaseUser.metadata.lastSignInTime || firebaseUser.metadata.creationTime),
        lastLoginAt: firebaseUser.metadata.lastSignInTime ? new Date(firebaseUser.metadata.lastSignInTime) : new Date(firebaseUser.metadata.creationTime),
        profile: {
            firstName,
            lastName,
            phoneNumber: firebaseUser.phoneNumber || null,
            dateOfBirth: null,
            address: null
        },
        preferences: {
            notifications: {
                email: true,
                push: true,
                sms: false
            },
            privacy: {
                profileVisibility: 'public'
            }
        },
        watchlist: [],
        // Migration metadata
        migratedAt: new Date(),
        migrationSource: 'firebase-auth'
    };
}

/**
 * Check if user already exists in MongoDB
 */
async function userExistsInMongoDB(uid) {
    try {
        const usersCollection = db.collection('users');
        const existingUser = await usersCollection.findOne({ uid });
        return !!existingUser;
    } catch (error) {
        console.error(`❌ Error checking user existence for ${uid}:`, error.message);
        return false;
    }
}

/**
 * Create user in MongoDB
 */
async function createUserInMongoDB(userData) {
    try {
        const usersCollection = db.collection('users');
        const result = await usersCollection.insertOne(userData);
        return result.insertedId;
    } catch (error) {
        console.error(`❌ Error creating user ${userData.uid}:`, error.message);
        throw error;
    }
}

/**
 * Process a batch of Firebase users
 */
async function processBatch(firebaseUsers) {
    const results = {
        processed: 0,
        created: 0,
        skipped: 0,
        errors: 0
    };

    for (const firebaseUser of firebaseUsers) {
        try {
            results.processed++;

            // Check if user already exists in MongoDB
            const exists = await userExistsInMongoDB(firebaseUser.uid);
            
            if (exists) {
                console.log(`⏭️  User ${firebaseUser.uid} (${firebaseUser.email}) already exists in MongoDB`);
                results.skipped++;
                continue;
            }

            // Map Firebase user to MongoDB schema
            const mongoUserData = mapFirebaseUserToMongoDB(firebaseUser);

            if (isDryRun) {
                console.log(`🔍 [DRY RUN] Would create user: ${firebaseUser.uid} (${firebaseUser.email})`);
                console.log(`   Created: ${mongoUserData.createdAt.toISOString()}`);
                console.log(`   Last Login: ${mongoUserData.lastLoginAt.toISOString()}`);
                results.created++;
            } else {
                // Create user in MongoDB
                const insertedId = await createUserInMongoDB(mongoUserData);
                console.log(`✅ Created user: ${firebaseUser.uid} (${firebaseUser.email}) -> MongoDB ID: ${insertedId}`);
                results.created++;
            }

        } catch (error) {
            console.error(`❌ Error processing user ${firebaseUser.uid}:`, error.message);
            results.errors++;
        }
    }

    return results;
}

/**
 * Main migration function
 */
async function migrateUsers() {
    try {
        // Connect to MongoDB
        await connectMongoDB();

        // Create indexes for better performance
        if (!isDryRun) {
            console.log('📊 Creating MongoDB indexes...');
            const usersCollection = db.collection('users');
            await usersCollection.createIndex({ uid: 1 }, { unique: true });
            await usersCollection.createIndex({ email: 1 }, { unique: true });
            await usersCollection.createIndex({ createdAt: 1 });
            await usersCollection.createIndex({ lastLoginAt: 1 });
            console.log('✅ Indexes created');
        }

        let nextPageToken;
        let totalResults = {
            processed: 0,
            created: 0,
            skipped: 0,
            errors: 0
        };

        console.log('🔄 Starting user migration...\n');

        do {
            // Fetch batch of users from Firebase
            console.log(`📥 Fetching batch of ${batchSize} users from Firebase...`);
            const listUsersResult = await admin.auth().listUsers(batchSize, nextPageToken);
            
            if (listUsersResult.users.length === 0) {
                console.log('ℹ️  No more users to process');
                break;
            }

            console.log(`📋 Processing ${listUsersResult.users.length} users...`);

            // Process the batch
            const batchResults = await processBatch(listUsersResult.users);

            // Update totals
            totalResults.processed += batchResults.processed;
            totalResults.created += batchResults.created;
            totalResults.skipped += batchResults.skipped;
            totalResults.errors += batchResults.errors;

            // Show batch summary
            console.log(`📊 Batch Summary: ${batchResults.created} created, ${batchResults.skipped} skipped, ${batchResults.errors} errors\n`);

            nextPageToken = listUsersResult.pageToken;

        } while (nextPageToken);

        // Final summary
        console.log('🎉 Migration Complete!');
        console.log('=====================');
        console.log(`Total Processed: ${totalResults.processed}`);
        console.log(`Created: ${totalResults.created}`);
        console.log(`Skipped (already exist): ${totalResults.skipped}`);
        console.log(`Errors: ${totalResults.errors}`);

        if (isDryRun) {
            console.log('\n💡 This was a dry run. No changes were made to MongoDB.');
            console.log('   Run without --dry-run to perform the actual migration.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        // Cleanup connections
        if (mongoClient) {
            await mongoClient.close();
            console.log('✅ MongoDB connection closed');
        }
        
        if (firebaseApp) {
            await firebaseApp.delete();
            console.log('✅ Firebase connection closed');
        }
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n⚠️  Migration interrupted by user');
    if (mongoClient) await mongoClient.close();
    if (firebaseApp) await firebaseApp.delete();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⚠️  Migration terminated');
    if (mongoClient) await mongoClient.close();
    if (firebaseApp) await firebaseApp.delete();
    process.exit(0);
});

// Run the migration
migrateUsers();