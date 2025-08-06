#!/bin/bash

# Deployment script for Cloud Run
# Make sure you have gcloud CLI installed and authenticated

# Set variables - REPLACE WITH YOUR ACTUAL PROJECT ID
PROJECT_ID="spec`ter-fi"  # Replace this with your actual GCP project ID
SERVICE_NAME="ai-investment-service"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Function to check if command was successful
check_success() {
    if [ $? -ne 0 ]; then
        echo "❌ Error: $1 failed"
        exit 1
    fi
}

echo "🚀 Starting deployment to Cloud Run..."
echo "📋 Project ID: $PROJECT_ID"
echo "📋 Service Name: $SERVICE_NAME"
echo "📋 Region: $REGION"

# Check if gcloud is authenticated
echo "🔐 Checking authentication..."
gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1
if [ $? -ne 0 ]; then
    echo "❌ Please run 'gcloud auth login' first"
    exit 1
fi

# Set the project
echo "🎯 Setting project..."
gcloud config set project $PROJECT_ID
check_success "Setting project"

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com
check_success "Enabling APIs"

# Configure Docker authentication
echo "🐳 Configuring Docker authentication..."
gcloud auth configure-docker --quiet
check_success "Docker authentication"

# Build and tag the Docker image
echo "📦 Building Docker image..."
docker build -t $IMAGE_NAME .
check_success "Docker build"

# Push the image to Google Container Registry
echo "⬆️ Pushing image to Container Registry..."
docker push $IMAGE_NAME
check_success "Docker push"

# Deploy to Cloud Run
echo "🌐 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 3001 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --project $PROJECT_ID

check_success "Cloud Run deployment"

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
echo "1. Set up environment variables if needed"
echo "2. Configure custom domain (optional)"
echo "3. Update your frontend to use the new API URL"