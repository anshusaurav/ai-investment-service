#!/bin/bash

# Production Secret Setup Script
# This script sets up Google Secret Manager for secure credential storage

set -e

PROJECT_ID=${1:-$(gcloud config get-value project)}
SERVICE_ACCOUNT_EMAIL="firebase-adminsdk-d93k8@${PROJECT_ID}.iam.gserviceaccount.com"

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: PROJECT_ID not set. Please run:"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    echo "   or pass project ID as first argument"
    exit 1
fi

echo "🔐 Setting up production secrets for project: $PROJECT_ID"

# Enable Secret Manager API
echo "📡 Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID

# Check if service account key file exists
if [ ! -f "firebase-key.json" ]; then
    echo "🔑 Creating new service account key..."
    gcloud iam service-accounts keys create firebase-key.json \
        --iam-account=$SERVICE_ACCOUNT_EMAIL \
        --project=$PROJECT_ID
else
    echo "✅ Using existing firebase-key.json"
fi

# Create secret in Secret Manager
echo "🗝️  Creating secret in Secret Manager..."
if gcloud secrets describe firebase-service-account-key --project=$PROJECT_ID >/dev/null 2>&1; then
    echo "⚠️  Secret already exists. Creating new version..."
    gcloud secrets versions add firebase-service-account-key \
        --data-file=firebase-key.json \
        --project=$PROJECT_ID
else
    echo "📝 Creating new secret..."
    gcloud secrets create firebase-service-account-key \
        --data-file=firebase-key.json \
        --project=$PROJECT_ID
fi

# Grant Cloud Run access to the secret
echo "🔐 Granting Cloud Run access to secret..."
CLOUD_RUN_SA="${PROJECT_ID}@appspot.gserviceaccount.com"
gcloud secrets add-iam-policy-binding firebase-service-account-key \
    --member="serviceAccount:${CLOUD_RUN_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

# Also grant access to the Compute Engine default service account (used by Cloud Build)
COMPUTE_SA="${PROJECT_ID}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding firebase-service-account-key \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

# Clean up local key file for security
echo "🧹 Cleaning up local key file..."
rm -f firebase-key.json

echo ""
echo "✅ Production secrets setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Your service account key is now stored securely in Secret Manager"
echo "2. Cloud Run will automatically mount it as an environment variable"
echo "3. Deploy using: gcloud builds submit --config cloudbuild.yaml"
echo ""
echo "🔍 To verify the secret:"
echo "   gcloud secrets versions list firebase-service-account-key --project=$PROJECT_ID"
echo ""
echo "🚨 Security reminders:"
echo "- The local key file has been deleted for security"
echo "- Never commit service account keys to version control"
echo "- Rotate keys regularly (every 90 days recommended)"
echo "- Monitor secret access in Cloud Audit Logs"