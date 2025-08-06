# Deployment Guide - GCP Cloud Run

## Overview
This guide covers deploying your Node.js backend to Google Cloud Platform using Cloud Run.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed locally
4. **Project setup** in GCP

## Setup Instructions

### 1. Install gcloud CLI
```bash
# macOS
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate and Setup
```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 3. Configure Docker for GCP
```bash
# Configure Docker to use gcloud as credential helper
gcloud auth configure-docker
```

## Deployment Options

### Option 1: Manual Deployment (Recommended for first time)

1. **Build and push Docker image:**
```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"

# Build the image
docker build -t gcr.io/$PROJECT_ID/ai-investment-service .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/ai-investment-service
```

2. **Deploy to Cloud Run:**
```bash
gcloud run deploy ai-investment-service \
  --image gcr.io/$PROJECT_ID/ai-investment-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3001 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production
```

3. **Set environment variables:**
```bash
# Set MongoDB URI
gcloud run services update ai-investment-service \
  --set-env-vars MONGODB_URI="your-mongodb-connection-string" \
  --region us-central1

# Set other environment variables
gcloud run services update ai-investment-service \
  --set-env-vars MONGODB_DATABASE=specter-db,MONGODB_COLLECTION=companies \
  --region us-central1
```

### Option 2: Using the Deploy Script
```bash
# Edit deploy.sh with your project ID
# Then run:
./deploy.sh
```

### Option 3: Automated with Cloud Build
```bash
# Submit build to Cloud Build
gcloud builds submit --config cloudbuild.yaml .
```

## Environment Variables Setup

### Using gcloud CLI:
```bash
gcloud run services update ai-investment-service \
  --set-env-vars \
  NODE_ENV=production,\
  MONGODB_URI="your-mongodb-uri",\
  MONGODB_DATABASE=specter-db,\
  MONGODB_COLLECTION=companies,\
  FIREBASE_PROJECT_ID=screener-specter \
  --region us-central1
```

### Using Secret Manager (Recommended for sensitive data):
```bash
# Create secrets
echo -n "your-mongodb-uri" | gcloud secrets create mongodb-uri --data-file=-
echo -n "your-firebase-key" | gcloud secrets create firebase-key --data-file=-

# Update service to use secrets
gcloud run services update ai-investment-service \
  --set-secrets MONGODB_URI=mongodb-uri:latest,FIREBASE_SERVICE_ACCOUNT_KEY=firebase-key:latest \
  --region us-central1
```

## Custom Domain Setup

1. **Map custom domain:**
```bash
gcloud run domain-mappings create \
  --service ai-investment-service \
  --domain api.yourdomain.com \
  --region us-central1
```

2. **Update DNS records** as instructed by the command output

## CORS Configuration

Update your frontend domain in the environment variables:
```bash
gcloud run services update ai-investment-service \
  --set-env-vars ALLOWED_ORIGINS="https://yourfrontend.com,https://yourdomain.vercel.app" \
  --region us-central1
```

## Monitoring and Logs

### View logs:
```bash
gcloud run services logs read ai-investment-service --region us-central1
```

### Monitor in Console:
- Go to [Cloud Run Console](https://console.cloud.google.com/run)
- Click on your service
- View metrics, logs, and revisions

## Cost Optimization

### Current Configuration:
- **Memory**: 1Gi
- **CPU**: 1 vCPU
- **Max instances**: 10
- **Pricing**: Pay per request + compute time

### Estimated Costs:
- **Free tier**: 2 million requests/month
- **After free tier**: ~$0.40 per million requests
- **Memory/CPU**: ~$0.0000024 per GB-second

### Optimization Tips:
1. **Reduce memory** if not needed (minimum 128Mi)
2. **Set max instances** based on expected traffic
3. **Use concurrency** settings (default 80 requests per instance)
4. **Enable CPU allocation only during requests**

## Troubleshooting

### Common Issues:

1. **Port binding error:**
   - Ensure your app listens on `process.env.PORT || 3001`
   - Cloud Run sets the PORT environment variable

2. **Environment variables not working:**
   - Check if variables are set: `gcloud run services describe ai-investment-service --region us-central1`

3. **MongoDB connection issues:**
   - Ensure MongoDB Atlas allows connections from 0.0.0.0/0
   - Check connection string format

4. **Build failures:**
   - Check Dockerfile syntax
   - Ensure all dependencies are in package.json

### Debug Commands:
```bash
# Check service status
gcloud run services describe ai-investment-service --region us-central1

# View recent logs
gcloud run services logs read ai-investment-service --region us-central1 --limit 50

# Test locally with Docker
docker run -p 3001:3001 --env-file .env.production gcr.io/$PROJECT_ID/ai-investment-service
```

## Security Best Practices

1. **Use Secret Manager** for sensitive data
2. **Enable IAM authentication** for internal services
3. **Set up VPC connector** if needed for private resources
4. **Use HTTPS only** (enabled by default)
5. **Implement rate limiting** (already configured)
6. **Regular security updates** for dependencies

## Scaling Configuration

```bash
# Update scaling settings
gcloud run services update ai-investment-service \
  --min-instances 0 \
  --max-instances 100 \
  --concurrency 80 \
  --cpu-throttling \
  --region us-central1
```

## Rollback

```bash
# List revisions
gcloud run revisions list --service ai-investment-service --region us-central1

# Rollback to previous revision
gcloud run services update-traffic ai-investment-service \
  --to-revisions REVISION_NAME=100 \
  --region us-central1
```

Your API will be available at: `https://ai-investment-service-[hash]-uc.a.run.ap