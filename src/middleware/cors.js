const cors = require('cors');
const logger = require('../utils/logger');

const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
            : ['chrome-extension://*', 'http://localhost:3000', 'https://specterfi.com', 'https://ai-investment-web.vercel.app'];

        // Always log CORS info in production for debugging
        logger.info(`CORS: Checking origin: ${origin}`);
        logger.info(`CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
        logger.info(`CORS: Environment: ${process.env.NODE_ENV}`);

        // Allow requests with no origin (mobile apps, postman, etc.)
        if (!origin) {
            logger.info('CORS: No origin header, allowing request');
            return callback(null, true);
        }

        // Check if origin is in allowed list or matches chrome-extension pattern
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin.includes('*')) {
                const pattern = allowedOrigin.replace('*', '.*');
                return new RegExp(pattern).test(origin);
            }
            return allowedOrigin === origin;
        });

        if (isAllowed) {
            logger.info(`CORS: Origin allowed: ${origin}`);
            callback(null, true);
        } else {
            logger.warn(`CORS: Origin not allowed: ${origin}`);
            logger.warn(`CORS: Available origins: ${allowedOrigins.join(', ')}`);
            logger.warn(`CORS: ALLOWED_ORIGINS env var: ${process.env.ALLOWED_ORIGINS}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    preflightContinue: false
};

module.exports = cors(corsOptions);