# Deployment Security Guide

## Issue Fixed
The commit error occurred because sensitive data (private keys) were found in `.env.docker`. This has been resolved by:

1. Adding `.env.docker` to `.gitignore`
2. Removing sensitive data from `.env.docker`
3. Creating a template file for reference

## Secure Deployment Options

### Option 1: Environment Variables (Recommended for Cloud Run)

Set these environment variables in your deployment platform:

```bash
# Firebase
FIREBASE_PROJECT_ID=screener-specter
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"screener-specter",...}'

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/...
MONGODB_DATABASE=specter-db
MONGODB_COLLECTION=companies

# API Keys
GEMINI_API_KEY=your-api-key

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://your-app.vercel.app
```

### Option 2: Service Account Key File (Alternative)

1. Create a `serviceAccountKey.json` file (already in `.gitignore`)
2. Update Firebase config to use the file:

```javascript
// src/config/firebase.js
const admin = require('firebase-admin');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Use environment variable (production)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} else {
    // Use file (development)
    serviceAccount = require('../../serviceAccountKey.json');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
});
```

### Option 3: Google Cloud Secret Manager (Most Secure)

For production deployments, use Google Cloud Secret Manager:

```bash
# Store secrets
gcloud secrets create firebase-service-account --data-file=serviceAccountKey.json
gcloud secrets create mongodb-uri --data-file=-

# Grant access to Cloud Run service
gcloud secrets add-iam-policy-binding firebase-service-account \
    --member="serviceAccount:your-service@your-project.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## Docker Deployment

### Using Environment Variables

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

```bash
# Build and run with environment variables
docker build -t ai-investment-service .
docker run -p 8080:8080 \
  -e FIREBASE_PROJECT_ID=screener-specter \
  -e FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}' \
  -e MONGODB_URI=mongodb+srv://... \
  ai-investment-service
```

### Using Docker Secrets (Production)

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    secrets:
      - firebase_key
      - mongodb_uri
    environment:
      - FIREBASE_PROJECT_ID=screener-specter
      - FIREBASE_SERVICE_ACCOUNT_KEY_FILE=/run/secrets/firebase_key
      - MONGODB_URI_FILE=/run/secrets/mongodb_uri

secrets:
  firebase_key:
    file: ./secrets/firebase-key.json
  mongodb_uri:
    file: ./secrets/mongodb-uri.txt
```

## Google Cloud Run Deployment

```bash
# Deploy with environment variables
gcloud run deploy ai-investment-service \
  --image gcr.io/your-project/ai-investment-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=screener-specter \
  --set-env-vars MONGODB_DATABASE=specter-db \
  --set-env-vars ALLOWED_ORIGINS=https://yourdomain.com
```

## Security Best Practices

1. **Never commit sensitive data** to version control
2. **Use environment variables** for secrets in production
3. **Rotate keys regularly** - especially API keys and database passwords
4. **Use least privilege** - grant minimal required permissions
5. **Monitor access** - enable logging for secret access
6. **Use managed services** - like Google Secret Manager for production

## Files to Keep Secure

- `.env` (development only, in .gitignore)
- `.env.docker` (now in .gitignore)
- `serviceAccountKey.json` (if used, in .gitignore)
- Any files ending in `-key.json` or `-credentials.json`

## What's Safe to Commit

- `.env.docker.template` (template without real values)
- Configuration files with placeholder values
- Documentation and guides
- Code that references environment variables

## Next Steps

1. Copy `.env.docker.template` to `.env.docker` and fill in your values locally
2. Set up environment variables in your deployment platform
3. Remove any remaining sensitive data from tracked files
4. Consider using Google Secret Manager for production deployments