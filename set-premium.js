require('dotenv').config();
const { MongoClient } = require('mongodb');
const redis = require('./src/config/redis');

const EMAIL = 'anshu.saurav@gmail.com';
// Premium until 2099 — effectively lifetime
const EXPIRES_AT = new Date('2099-12-31T23:59:59.999Z');

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DATABASE || 'specter-db');
  const users = db.collection('users');

  const user = await users.findOne({ email: EMAIL });
  if (!user) {
    console.error(`❌ User not found: ${EMAIL}`);
    await client.close();
    process.exit(1);
  }

  console.log(`Found user: uid=${user.uid}  current subscription=${JSON.stringify(user.subscription)}`);

  const result = await users.updateOne(
    { email: EMAIL },
    {
      $set: {
        subscription: {
          plan: 'premium',
          billingCycle: 'annual',
          startedAt: new Date(),
          expiresAt: EXPIRES_AT,
          source: 'manual',
        },
        updatedAt: new Date(),
      },
    }
  );

  console.log(`✅ MongoDB updated — matchedCount=${result.matchedCount} modifiedCount=${result.modifiedCount}`);

  // Bust the Redis cache so the service picks up the change immediately
  try {
    const cacheKey = `user-premium:${user.uid}`;
    await redis.del(cacheKey);
    console.log(`✅ Redis cache cleared: ${cacheKey}`);
  } catch (e) {
    console.warn(`⚠️  Redis cache clear failed (non-fatal): ${e.message}`);
  }

  await client.close();
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
