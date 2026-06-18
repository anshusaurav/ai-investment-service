/**
 * Resets subscription to free plan for a given email.
 * Run: node reset-subscription.js
 */
require('dotenv').config();
const mongodb = require('./src/config/mongodb');

const TARGET_EMAIL = 'anshu.saurav@gmail.com';

async function main() {
    await mongodb.connect();
    const db = mongodb.getDb();
    const users = db.collection('users');

    const user = await users.findOne({ email: TARGET_EMAIL });
    if (!user) {
        console.error(`❌ User not found: ${TARGET_EMAIL}`);
        process.exit(1);
    }

    console.log(`Found user: ${user.name} (${user.uid})`);
    console.log(`Current subscription:`, JSON.stringify(user.subscription, null, 2));

    const result = await users.updateOne(
        { email: TARGET_EMAIL },
        {
            $set: {
                subscription: {
                    plan: 'free',
                    billingCycle: null,
                    source: null,
                    startedAt: null,
                    expiresAt: null,
                },
                updatedAt: new Date(),
            }
        }
    );

    console.log(`\n✅ Subscription reset to free (modified: ${result.modifiedCount})`);
    await mongodb.disconnect();
    process.exit(0);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
