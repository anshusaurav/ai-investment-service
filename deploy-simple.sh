#!/bin/bash

# Simple deployment script using source-based deployment
# This is often more reliable than Docker-based deployment

# Set variables - REPLACE WITH YOUR ACTUAL PROJECT ID
PROJECT_ID="specter-fi"  # Replace this with your actual GCP project ID
SERVICE_NAME="ai-investment-service"
REGION="us-central1"

echo "🚀 Starting simple deployment to Cloud Run..."
echo "📋 Project ID: $PROJECT_ID"
echo "📋 Service Name: $SERVICE_NAME"
echo "📋 Region: $REGION"

# Check if gcloud is authenticated
echo "🔐 Checking authentication..."
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "❌ Please run 'gcloud auth login' first"
    exit 1
fi
echo "✅ Authenticated as: $ACTIVE_ACCOUNT"

# Set the project
echo "🎯 Setting project..."
gcloud config set project $PROJECT_ID
if [ $? -ne 0 ]; then
    echo "❌ Failed to set project. Please check your project ID."
    exit 1
fi

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com

# Deploy using source code (Cloud Build will handle Docker)
echo "🌐 Deploying to Cloud Run from source..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --project $PROJECT_ID

if [ $? -eq 0 ]; then
    echo "✅ Deployment completed successfully!"
    
    # Get the service URL
    echo "🔗 Getting service URL..."
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --project $PROJECT_ID --format 'value(status.url)' 2>/dev/null)
    
    if [ -n "$SERVICE_URL" ]; then
        echo "🎉 Your service is live at: $SERVICE_URL"
        echo ""
        echo "🧪 Test your deployment:"
        echo "curl $SERVICE_URL/health"
        echo ""
        echo "🔍 Test search endpoint:"
        echo "curl -X POST $SERVICE_URL/api/company/search -H 'Content-Type: application/json' -d '{\"q\": \"Carysil\"}'"
    else
        echo "⚠️ Could not retrieve service URL. Check the Cloud Console:"
        echo "https://console.cloud.google.com/run?project=$PROJECT_ID"
    fi
    
    echo ""
    echo "📊 Next steps:"
    echo "1. Set up environment variables:"
    echo "   ./set-env-vars.sh"
    echo "2. Configure custom domain (optional)"
    echo "3. Update your frontend to use the new API URL"
else
    echo "❌ Deployment failed. Check the error messages above."
    echo "💡 Common issues:"
    echo "   - Check if your project ID is correct"
    echo "   - Ensure billing is enabled for your project"
    echo "   - Verify you have the necessary permissions"
    exit 1
fi