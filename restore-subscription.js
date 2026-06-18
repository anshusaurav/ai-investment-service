require('dotenv').config();
const mongodb = require('./src/config/mongodb');

async function main() {
    await mongodb.connect();
    const db = mongodb.getDb();
    await db.collection('users').updateOne(
        { email: 'anshu.saurav@gmail.com' },
        {
            $set: {
                subscription: {
                    plan: 'premium',
                    billingCycle: 'annual',
                    source: 'manual',
                    startedAt: new Date(),
                    expiresAt: new Date('2099-12-31T23:59:59.999Z'),
                },
                updatedAt: new Date(),
            }
        }
    );
    console.log('✅ Restored to premium');
    await mongodb.disconnect();
    process.exit(0);
}
main().catch(err => { console.error(err.message); process.exit(1); });
