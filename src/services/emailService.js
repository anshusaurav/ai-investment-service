const { Resend } = require('resend');
const logger = require('../utils/logger');

const FROM_ADDRESS = 'SpecterFi <hello@specterfi.com>';

let resend = null;

function getClient() {
    if (!resend) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY is not configured');
        }
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

// ── Email templates ────────────────────────────────────────────────────────────

function trialEndingTemplate(name, daysLeft) {
    const firstName = name ? name.split(' ')[0] : 'there';
    const urgencyLine = daysLeft === 0
        ? 'Your free trial ends <strong>today</strong>.'
        : `Your free trial ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your SpecterFi trial is ending</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#7c3aed;padding:24px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="https://www.specterfi.com/logo.png" alt="" width="36" height="36" style="display:block;border-radius:6px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">SpecterFi</p>
                    <p style="margin:2px 0 0;color:#ddd6fe;font-size:12px;">AI-powered investment research</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${firstName},</p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${urgencyLine} After that, you'll move to the free plan — you can still access the app, but with limits on summaries and guidance tracking.</p>

              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#111827;">What you keep with Premium:</p>
              <ul style="margin:0 0 24px;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
                <li>Unlimited AI conference call summaries with verbatim quotes</li>
                <li>Unlimited guidance tracker views across all companies</li>
                <li>Full Financial Insights</li>
                <li>Priority support</li>
              </ul>

              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#7c3aed;border-radius:6px;padding:12px 28px;">
                    <a href="https://www.specterfi.com/premium" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Upgrade now — ₹299/month</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#6b7280;">Annual plan available at ₹2,999/year (save 17%). Full refund within 48 hours, no questions asked.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">You received this because you signed up for SpecterFi. Questions? Reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Send functions ─────────────────────────────────────────────────────────────

async function sendTrialEndingEmail(user, daysLeft) {
    const subject = daysLeft === 0
        ? 'Your SpecterFi trial ends today'
        : `Your SpecterFi trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

    try {
        const { data, error } = await getClient().emails.send({
            from: FROM_ADDRESS,
            to: user.email,
            subject,
            html: trialEndingTemplate(user.name, daysLeft),
        });

        if (error) {
            logger.error(`Failed to send trial email to ${user.email}:`, error);
            return false;
        }

        logger.info(`Trial expiry email (D-${daysLeft}) sent to ${user.email}: ${data.id}`);
        return true;
    } catch (err) {
        logger.error(`Error sending trial email to ${user.email}:`, err.message);
        return false;
    }
}

module.exports = { sendTrialEndingEmail };
