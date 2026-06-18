/**
 * SpecterFi "Earnings Edge" newsletter generator
 *
 * Dynamically fetches companies whose LATEST concall is within a recent
 * time window, picks diverse stories, and builds the newsletter HTML.
 *
 * Usage:
 *   node send-newsletter.js                    # dry run — logs HTML preview
 *   node send-newsletter.js --send             # send to default address
 *   node send-newsletter.js --send --to foo@bar.com
 *   node send-newsletter.js --window 45        # lookback in days (default 60)
 */

require('dotenv').config();
const admin = require('firebase-admin');
const { Resend } = require('resend');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const SEND       = args.includes('--send');
const TO         = args.includes('--to') ? args[args.indexOf('--to') + 1] : 'anshu.saurav@gmail.com';
const WINDOW_DAYS = args.includes('--window') ? parseInt(args[args.indexOf('--window') + 1]) : 60;

const MAX_FEATURED   = 3;
const MAX_QUICK_HITS = 4;

// ── Quarter helpers ───────────────────────────────────────────────────────────

const MONTH_MAP = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

function parseQuarterDate(label) {
    if (!label) return null;
    const m = label.match(/^([A-Za-z]+)(\d{4})$/);
    if (!m) return null;
    const mo = MONTH_MAP[m[1]];
    if (mo === undefined) return null;
    return new Date(parseInt(m[2]), mo, 1);
}

function formatQuarter(label) {
    return label?.replace(/([A-Za-z]+)(\d+)/, '$1 $2') || label;
}

// ── Industry helpers ──────────────────────────────────────────────────────────

const INDUSTRY_TOP = {
    IN01: 'Energy & Oil',
    IN02: 'Consumer',
    IN03: 'Industrials',
    IN04: 'FMCG',
    IN05: 'Chemicals',
    IN06: 'Pharma',
    IN07: 'Infrastructure',
    IN08: 'Technology',
    IN09: 'Aviation',
    IN10: 'Real Estate',
    IN11: 'Power & Utilities',
};

function industryName(path) {
    const m = path?.match(/\/(IN\d+)\//);
    return m ? (INDUSTRY_TOP[m[1]] || m[1]) : 'Diversified';
}

// Badge color: red for loss/decline stories, green for growth, blue default
function sentimentBadge(summary) {
    const s = (summary || '').toLowerCase();
    const green = ['record', 'all-time high', 'all time high', 'highest ever', 'best-ever', 'surge', 'jumped', 'strong growth'];
    const red   = ['net loss', 'declined', 'decline', 'fell ', 'down %', 'down by'];
    if (green.some(k => s.includes(k))) return 'green';
    if (red.some(k => s.includes(k)))   return 'red';
    return 'blue';
}

const BADGE_COLORS = {
    green: { bg: '#f0fdf4', text: '#16a34a', bar: '#16a34a' },
    red:   { bg: '#fef2f2', text: '#dc2626', bar: '#dc2626' },
    blue:  { bg: '#eff6ff', text: '#1d4ed8', bar: '#3b82f6' },
};

// ── Summary extraction ────────────────────────────────────────────────────────

function extractSummaryText(markdown) {
    if (!markdown) return '';
    let text = markdown;
    // Take content after ===SUMMARY_START=== if present
    const marker = text.indexOf('===SUMMARY_START===');
    if (marker !== -1) text = text.slice(marker + 19);
    // Strip markdown headings, bold, italic, code, links
    text = text
        .replace(/#{1,6}\s+[^\n]+/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`[^`]+`/g, '')
        .replace(/\|[^\n]+/g, '')       // strip table rows
        .replace(/[-*]\s+/g, '')
        .replace(/\n{2,}/g, '\n')
        .trim();
    // Return first ~350 chars ending at a sentence boundary
    if (text.length <= 350) return text;
    const cut = text.lastIndexOf('.', 350);
    return cut > 100 ? text.slice(0, cut + 1) : text.slice(0, 350) + '…';
}

// ── Firestore fetch ───────────────────────────────────────────────────────────

function initFirebase() {
    if (admin.apps.length) return admin.apps[0];
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    return admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: process.env.FIREBASE_PROJECT_ID,
    });
}

async function fetchRecentConcalls() {
    initFirebase();
    const db = admin.firestore();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);

    console.log(`\nFetching documents… (looking back ${WINDOW_DAYS} days to ${cutoff.toDateString()})`);

    const results = [];
    let last = null;
    const PAGE = 500;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        let q = db.collection('documents').orderBy('__name__').limit(PAGE);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        last = snap.docs[snap.docs.length - 1];
        process.stdout.write(`  fetched ${results.length + snap.docs.length} docs…\r`);

        for (const doc of snap.docs) {
            const data = doc.data();
            const concalls = data?.documents?.['Concalls'] || [];

            const processed = concalls
                .filter(c => c.markdownOutput?.trim().length > 100 && c.quarter)
                .sort((a, b) => (parseQuarterDate(b.quarter) || 0) - (parseQuarterDate(a.quarter) || 0));

            if (!processed.length) continue;

            const latest = processed[0];
            const qDate  = parseQuarterDate(latest.quarter);
            if (!qDate || qDate < cutoff) continue;

            results.push({
                companyCode: data.companyCode,
                companyName: data.companyName || data.name || doc.id,
                industry:    industryName(data.industry),
                industrySeg: data.industry || '',
                quarter:     latest.quarter,
                quarterDate: qDate,
                summary:     extractSummaryText(latest.markdownOutput),
                rawSummary:  latest.markdownOutput?.slice(0, 200) || '',
            });
        }

        if (snap.docs.length < PAGE) break;
    }

    console.log(`\nFound ${results.length} companies with concalls in the last ${WINDOW_DAYS} days.\n`);

    // Sort newest first
    results.sort((a, b) => b.quarterDate - a.quarterDate);

    // Deduplicate by industry — keep the freshest per industry for diversity
    const seen = new Set();
    const diverse = [];
    for (const r of results) {
        if (!seen.has(r.industry)) {
            seen.add(r.industry);
            diverse.push(r);
        }
    }
    // Fill remaining slots with next-best regardless of industry
    const diverseSet = new Set(diverse.map(r => r.companyCode));
    for (const r of results) {
        if (diverse.length >= MAX_FEATURED + MAX_QUICK_HITS) break;
        if (!diverseSet.has(r.companyCode)) {
            diverse.push(r);
            diverseSet.add(r.companyCode);
        }
    }

    return diverse.slice(0, MAX_FEATURED + MAX_QUICK_HITS);
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function featuredCard(story, idx) {
    const sentiment = sentimentBadge(story.rawSummary);
    const { bg, text, bar } = BADGE_COLORS[sentiment];
    const divider = idx < MAX_FEATURED - 1
        ? '<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;"><tr><td style="border-top:1px solid #f3f4f6;"></td></tr></table>'
        : '';
    return `
            <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
              <tr><td>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:${bg};border-radius:6px;padding:4px 10px;">
                      <p style="margin:0;color:${text};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">${story.industry} · ${story.companyName}</p>
                    </td>
                    <td style="padding-left:10px;">
                      <p style="margin:0;color:#9ca3af;font-size:11px;">Q4 FY26 · ${formatQuarter(story.quarter)}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:10px 0 12px;font-size:18px;font-weight:700;color:#111827;line-height:1.3;">${story.companyName} — ${formatQuarter(story.quarter)} results</p>
                <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.7;">${escapeHtml(story.summary)}</p>
                <p style="margin:0;">
                  <a href="https://www.specterfi.com/companies/${story.companyCode}" style="color:${bar};font-size:13px;font-weight:600;text-decoration:none;">Read full analysis →</a>
                </p>
              </td></tr>
            </table>
            ${divider}`;
}

function quickHitCard(story) {
    const sentiment = sentimentBadge(story.rawSummary);
    const { bar } = BADGE_COLORS[sentiment];
    return `
                  <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:10px;padding:14px;background:#fafafa;border-radius:8px;border:1px solid #f3f4f6;">
                    <tr>
                      <td width="4" style="background:${bar};border-radius:4px;">&nbsp;</td>
                      <td style="padding-left:14px;">
                        <p style="margin:0 0 2px;font-size:11px;color:#7c3aed;font-weight:600;">${story.industry} · ${formatQuarter(story.quarter)}</p>
                        <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#111827;">${story.companyName}</p>
                        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">${escapeHtml(story.summary.slice(0, 180))}… <a href="https://www.specterfi.com/companies/${story.companyCode}" style="color:#7c3aed;text-decoration:none;font-weight:500;">read more</a></p>
                      </td>
                    </tr>
                  </table>`;
}

function escapeHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Newsletter HTML ───────────────────────────────────────────────────────────

function buildHtml(featured, quickHits, totalCount, windowDays) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const quarterLabel = featured[0]?.quarter || '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The Earnings Edge — by SpecterFi</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0 48px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- HEADER -->
    <tr><td style="background:#7c3aed;border-radius:12px 12px 0 0;padding:26px 32px;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr>
        <td>
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">SpecterFi</p>
          <p style="margin:3px 0 0;color:#ddd6fe;font-size:11px;letter-spacing:0.8px;text-transform:uppercase;">AI-powered investment research</p>
        </td>
        <td align="right">
          <p style="margin:0;color:#ede9fe;font-size:13px;font-weight:600;">The Earnings Edge</p>
          <p style="margin:3px 0 0;color:#c4b5fd;font-size:11px;">${dateStr}</p>
        </td>
      </tr></table>
    </td></tr>

    <!-- HERO -->
    <tr><td style="background:#6d28d9;padding:22px 32px 26px;">
      <p style="margin:0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;letter-spacing:-0.5px;">What India's boardrooms<br/>are saying this quarter</p>
      <p style="margin:10px 0 0;color:#ddd6fe;font-size:14px;line-height:1.65;">SpecterFi processed <strong style="color:#ffffff;">${totalCount}+ companies</strong> with results in the last ${windowDays} days. Here are the stories worth your attention — sourced directly from earnings call transcripts.</p>
    </td></tr>

    <!-- BODY -->
    <tr><td style="background:#ffffff;padding:32px;">

      ${featured.map((s, i) => featuredCard(s, i)).join('\n')}

      <!-- QUICK HITS -->
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
        <tr><td>
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#111827;padding-bottom:8px;border-bottom:2px solid #7c3aed;">More from this period</p>
          ${quickHits.map(s => quickHitCard(s)).join('\n')}
        </td></tr>
      </table>

      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;"><tr><td style="border-top:1px solid #f3f4f6;"></td></tr></table>

      <!-- PLATFORM SPOTLIGHT -->
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;">
        <tr><td style="background:#faf5ff;border-radius:10px;padding:22px 24px;border:1px solid #ddd6fe;">
          <p style="margin:0 0 4px;font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Platform Feature</p>
          <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#111827;">Full analyses for ${totalCount}+ companies — on SpecterFi</p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.65;">AI-generated summaries with verbatim quotes, financial metrics, and guidance tracker for every company. Search by sector, quarter, or metric. No PDFs, no delays.</p>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#7c3aed;border-radius:6px;padding:11px 24px;">
              <a href="https://www.specterfi.com" style="color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;">Explore latest results →</a>
            </td>
            <td style="padding-left:14px;">
              <a href="https://www.specterfi.com" style="color:#7c3aed;font-size:13px;font-weight:500;text-decoration:underline;">Guidance Tracker</a>
            </td>
          </tr></table>
        </td></tr>
      </table>

    </td></tr>

    <!-- CTA BAND -->
    <tr><td style="background:#7c3aed;padding:22px 32px;text-align:center;">
      <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#ffffff;">${totalCount}+ earnings calls analysed. All on SpecterFi.</p>
      <table cellpadding="0" cellspacing="0" align="center"><tr>
        <td style="background:#ffffff;border-radius:6px;padding:11px 28px;">
          <a href="https://www.specterfi.com" style="color:#7c3aed;font-size:13px;font-weight:700;text-decoration:none;">Open SpecterFi →</a>
        </td>
      </tr></table>
    </td></tr>

    <!-- FOOTER -->
    <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:18px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">You're receiving The Earnings Edge as part of the SpecterFi team. All summaries are AI-generated from earnings call transcripts and are for informational purposes only — not investment advice.</p>
      <p style="margin:0;font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} SpecterFi · <a href="https://www.specterfi.com" style="color:#7c3aed;text-decoration:none;">specterfi.com</a></p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Subject line builder ──────────────────────────────────────────────────────

function buildSubject(featured) {
    const names = featured.slice(0, 3).map(s => s.companyName.split(' ')[0]).join(', ');
    return `The Earnings Edge · ${names} and ${featured.length + 1} more — latest concall highlights`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const stories = await fetchRecentConcalls();

    if (!stories.length) {
        console.log('No recent concalls found. Try increasing --window.');
        process.exit(0);
    }

    const featured   = stories.slice(0, MAX_FEATURED);
    const quickHits  = stories.slice(MAX_FEATURED);
    const html       = buildHtml(featured, quickHits, stories.length, WINDOW_DAYS);
    const subject    = buildSubject(stories);

    console.log('\n--- Stories selected ---');
    stories.forEach((s, i) => console.log(`  ${i < MAX_FEATURED ? '★ Featured' : '  Quick  '} [${s.quarter}] ${s.companyName} (${s.industry})`));
    console.log(`\nSubject: ${subject}`);

    if (!SEND) {
        console.log('\n[Dry run] HTML length:', html.length, 'chars. Pass --send to send.');
        return;
    }

    if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY not set');
        process.exit(1);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
        from: 'SpecterFi <hello@specterfi.com>',
        to: TO,
        subject,
        html,
    });

    if (error) {
        console.error('Send failed:', error);
        process.exit(1);
    }

    console.log(`\nSent to ${TO}. Resend ID: ${data.id}`);
}

main().catch(console.error);
