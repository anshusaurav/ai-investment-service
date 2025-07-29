#!/bin/bash

# Google Cloud deployment script for AI Investment Service
# Make sure you have gcloud CLI installed and authenticated

set -e

# Configuration
PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}
SERVICE_NAME="ai-investment-service"

echo "🚀 Deploying AI Investment Service to Google Cloud..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Service Name: $SERVICE_NAME"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set the project
echo "📋 Setting project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and deploy using Cloud Build
echo "🏗️  Building and deploying with Cloud Build..."
gcloud builds submit --config cloudbuild.yaml \
    --substitutions=_SERVICE_NAME=$SERVICE_NAME,_REGION=$REGION

echo "✅ Deployment completed!"
echo "🌐 Your service should be available at:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"

# Alternative: Deploy to App Engine (uncomment if preferred)
# echo "🏗️  Deploying to App Engine..."
# gcloud app deploy app.yaml --quiet

echo "📊 To view logs:"
echo "gcloud logs tail --service=$SERVICE_NAME"