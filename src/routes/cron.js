/**
 * Cron endpoints — called by Google Cloud Scheduler (or any cron service).
 * Protected by CRON_SECRET header to prevent public abuse.
 *
 * Set up Cloud Scheduler to POST to:
 *   https://<service-url>/api/cron/trial-emails
 * Daily at 09:00 IST, with header: x-cron-secret: <CRON_SECRET env var>
 */
const express = require('express');
const router = express.Router();
const mongodb = require('../config/mongodb');
const { sendTrialEndingEmail } = require('../services/emailService');
const logger = require('../utils/logger');

function requireCronSecret(req, res, next) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        logger.warn('CRON_SECRET not set — cron endpoint is unprotected');
        return next();
    }
    if (req.headers['x-cron-secret'] !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// POST /api/cron/trial-emails
router.post('/trial-emails', requireCronSecret, async (req, res) => {
    try {
        const db = mongodb.getDb();
        const now = new Date();

        // Find trial users expiring in exactly 3 days (window: 3d to 4d from now)
        const d3Start = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const d3End   = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

        // Find trial users expiring today (window: now to 24h from now)
        const d0End   = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

        const [d3Users, d0Users] = await Promise.all([
            db.collection('users').find({
                'subscription.source': 'trial',
                'subscription.plan': 'premium',
                'subscription.expiresAt': { $gte: d3Start, $lt: d3End },
            }).toArray(),
            db.collection('users').find({
                'subscription.source': 'trial',
                'subscription.plan': 'premium',
                'subscription.expiresAt': { $gte: now, $lt: d0End },
            }).toArray(),
        ]);

        logger.info(`Trial email cron: ${d3Users.length} D-3 users, ${d0Users.length} D-0 users`);

        const results = { d3: { sent: 0, failed: 0 }, d0: { sent: 0, failed: 0 } };

        await Promise.all([
            ...d3Users.map(async user => {
                const ok = await sendTrialEndingEmail(user, 3);
                ok ? results.d3.sent++ : results.d3.failed++;
            }),
            ...d0Users.map(async user => {
                const ok = await sendTrialEndingEmail(user, 0);
                ok ? results.d0.sent++ : results.d0.failed++;
            }),
        ]);

        logger.info('Trial email cron complete:', results);
        res.json({ success: true, results });
    } catch (err) {
        logger.error('Trial email cron error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
