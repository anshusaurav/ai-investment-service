/**
 * Middleware to capture raw body for webhook signature verification
 */
const rawBodyMiddleware = (req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    let data = '';
    req.setEncoding('utf8');
    
    req.on('data', (chunk) => {
      data += chunk;
    });
    
    req.on('end', () => {
      req.rawBody = data;
      next();
    });
  } else {
    next();
  }
};

module.exports = rawBodyMiddleware;