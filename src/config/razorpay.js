const Razorpay = require('razorpay');

const razorpayConfig = {
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
  webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET
};

// Initialize Razorpay instance only if credentials are available
let razorpay = null;

if (razorpayConfig.key_id && razorpayConfig.key_secret) {
  razorpay = new Razorpay({
    key_id: razorpayConfig.key_id,
    key_secret: razorpayConfig.key_secret,
  });
} else {
  console.warn('Razorpay credentials not found. Payment functionality will be limited.');
}

module.exports = {
  razorpay,
  razorpayConfig
};