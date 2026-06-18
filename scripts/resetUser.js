/**
 * Reset usage limits and watchlist for a given user email.
 * Usage: node scripts/resetUser.js anshu.saurav@gmail.com
 */

require('dotenv').config();
const admin = require('firebase-admin');
const { MongoClient } = require('mongodb');

const EMAIL = process.argv[2] || 'anshu.saurav@gmail.com';

function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function run() {
    // ── Firebase Admin init ───────────────────────────────────────────────────
    if (!admin.apps.length) {
        let credential;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY));
        } else {
            credential = admin.credential.cert(require('../serviceAccountKey.json'));
        }
        admin.initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID });
    }

    console.log(`🔍 Looking up Firebase UID for: ${EMAIL}`);
    const userRecord = await admin.auth().getUserByEmail(EMAIL);
    const uid = userRecord.uid;
    console.log(`✅ Found UID: ${uid}`);

    // ── MongoDB ───────────────────────────────────────────────────────────────
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'specter-db');

    // 1. Reset usage (current month)
    const month = currentMonth();
    const usageResult = await db.collection('usage').updateOne(
        { userId: uid, month },
        { $set: { guidance: [], concalls: [], month } },
        { upsert: true }
    );
    console.log(`✅ Usage reset for ${month}:`, usageResult.acknowledged ? 'done' : 'failed');

    // 2. Clear watchlist
    const watchlistResult = await db.collection('users').updateOne(
        { uid },
        { $set: { watchlist: [], updatedAt: new Date() } }
    );
    console.log(`✅ Watchlist cleared:`, watchlistResult.modifiedCount > 0 ? 'done' : 'user not found in users collection');

    await client.close();
    await admin.app().delete();
    console.log('🎉 Reset complete.');
}

run().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
