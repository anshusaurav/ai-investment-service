# Quick Deploy to Cloud Run

## 🚀 5-Minute Deployment

### 1. Prerequisites
```bash
# Install gcloud CLI (if not installed)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Login and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com
```

### 2. Deploy
```bash
# Clone and navigate to your project
cd ai-investment-service

# Deploy with one command
gcloud run deploy ai-investment-service \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3001 \
  --memory 1Gi \
  --set-env-vars NODE_ENV=production,MONGODB_URI="mongodb+srv://25f1002017:VvD0Vr7Yl4mt9FLr@cluster0.3zoskau.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",MONGODB_DATABASE=specter-db,MONGODB_COLLECTION=companies
```

### 3. Set Remaining Environment Variables
```bash
gcloud run services update ai-investment-service \
  --set-env-vars \
  FIREBASE_PROJECT_ID=screener-specter,\
  GEMINI_API_KEY=AIzaSyBPFPSoEAdbsNTCVaZywU0Eq2A4Q_ERDnU,\
  ALLOWED_ORIGINS="https://your-frontend-domain.com" \
  --region us-central1
```

### 4. Set Firebase Service Account (Use Secret Manager)
```bash
# Create secret for Firebase key
echo 'YOUR_FIREBASE_SERVICE_ACCOUNT_JSON' | gcloud secrets create firebase-service-account --data-file=-

# Update service to use secret
gcloud run services update ai-investment-service \
  --set-secrets FIREBASE_SERVICE_ACCOUNT_KEY=firebase-service-account:latest \
  --region us-central1
```

### 5. Get Your API URL
```bash
gcloud run services describe ai-investment-service --platform managed --region us-central1 --format 'value(status.url)'
```

## ✅ Test Your Deployment

```bash
# Test health endpoint
curl https://YOUR_CLOUD_RUN_URL/health

# Test search endpoint
curl -X POST https://YOUR_CLOUD_RUN_URL/api/company/search \
  -H "Content-Type: application/json" \
  -d '{"q": "Carysil"}'
```

## 🔧 Update Deployment
```bash
# For code changes, just redeploy
gcloud run deploy ai-investment-service --source . --region us-central1
```

## 💰 Cost Estimate
- **Free tier**: 2M requests/month
- **After free tier**: ~$0.40 per 1M requests
- **Your expected cost**: $5-20/month for moderate usage

## 🌐 Custom Domain (Optional)
```bash
gcloud run domain-mappings create \
  --service ai-investment-service \
  --domain api.yourdomain.com \
  --region us-central1
```

That's it! Your API is now live on Cloud Run! 🎉