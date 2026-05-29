/**
 * One-time migration: give every existing user (except anshu.saurav@gmail.com)
 * a 30-day free trial, but only if they don't already have an active premium
 * subscription.
 *
 * Run with:  node add-trial-to-existing-users.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const redis = require('./src/config/redis');

const EXCLUDE_EMAIL = 'anshu.saurav@gmail.com';
const TRIAL_DAYS = 30;

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DATABASE || 'specter-db');
  const users = db.collection('users');

  const now = new Date();
  const trialExpiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  // Fetch all users except the excluded account
  const allUsers = await users.find({ email: { $ne: EXCLUDE_EMAIL } }).toArray();
  console.log(`Found ${allUsers.length} users to evaluate (excluding ${EXCLUDE_EMAIL})`);

  let trialAdded = 0;
  let alreadyActive = 0;
  let skipped = 0;

  for (const user of allUsers) {
    const sub = user.subscription;
    const hasActivePremium =
      sub &&
      sub.plan === 'premium' &&
      sub.source !== 'trial' &&   // not already a trial
      sub.expiresAt &&
      new Date(sub.expiresAt) > now;

    if (hasActivePremium) {
      alreadyActive++;
      console.log(`  ⏭️  Skipping ${user.email} — already has active paid premium`);
      continue;
    }

    // Already has an active trial → skip
    const hasActiveTrial =
      sub &&
      sub.source === 'trial' &&
      sub.expiresAt &&
      new Date(sub.expiresAt) > now;

    if (hasActiveTrial) {
      skipped++;
      console.log(`  ⏭️  Skipping ${user.email} — already has an active trial`);
      continue;
    }

    // Give trial
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          subscription: {
            plan: 'premium',
            billingCycle: 'trial',
            startedAt: now,
            expiresAt: trialExpiresAt,
            source: 'trial',
          },
          updatedAt: now,
        },
      }
    );

    // Bust Redis cache so the service picks up the change immediately
    try {
      await redis.del(`user-premium:${user.uid}`);
    } catch (e) {
      // non-fatal
    }

    trialAdded++;
    console.log(`  ✅ Trial added for ${user.email}`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Trials added:           ${trialAdded}`);
  console.log(`   ⏭️  Already active premium:  ${alreadyActive}`);
  console.log(`   ⏭️  Already on trial:        ${skipped}`);

  await client.close();
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
