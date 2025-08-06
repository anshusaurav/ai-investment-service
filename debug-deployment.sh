#!/bin/bash

# Debug script to help troubleshoot deployment issues

# Set variables
PROJECT_ID="specter-fi"  # Replace this with your actual GCP project ID
SERVICE_NAME="ai-investment-service"
REGION="us-central1"

echo "🔍 Debugging Cloud Run deployment..."
echo "📋 Project ID: $PROJECT_ID"
echo "📋 Service Name: $SERVICE_NAME"
echo "📋 Region: $REGION"
echo ""

# Check authentication
echo "1. 🔐 Checking authentication..."
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "❌ Not authenticated. Run: gcloud auth login"
else
    echo "✅ Authenticated as: $ACTIVE_ACCOUNT"
fi
echo ""

# Check project
echo "2. 🎯 Checking project configuration..."
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
echo "Current project: $CURRENT_PROJECT"
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "⚠️ Project mismatch. Run: gcloud config set project $PROJECT_ID"
fi
echo ""

# Check if project exists and billing is enabled
echo "3. 💳 Checking project and billing..."
gcloud projects describe $PROJECT_ID --format="value(projectId,lifecycleState)" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Project $PROJECT_ID not found or not accessible"
else
    echo "✅ Project exists and is accessible"
fi
echo ""

# Check enabled APIs
echo "4. 🔧 Checking enabled APIs..."
REQUIRED_APIS=("cloudbuild.googleapis.com" "run.googleapis.com" "containerregistry.googleapis.com")
for api in "${REQUIRED_APIS[@]}"; do
    if gcloud services list --enabled --filter="name:$api" --format="value(name)" | grep -q "$api"; then
        echo "✅ $api is enabled"
    else
        echo "❌ $api is NOT enabled. Run: gcloud services enable $api"
    fi
done
echo ""

# Check if service exists
echo "5. 🌐 Checking Cloud Run service..."
if gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID >/dev/null 2>&1; then
    echo "✅ Service $SERVICE_NAME exists in $REGION"
    
    # Get service details
    echo ""
    echo "📊 Service details:"
    gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format="table(
        metadata.name,
        status.url,
        status.conditions[0].type,
        status.conditions[0].status,
        spec.template.spec.containers[0].image
    )"
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format='value(status.url)' 2>/dev/null)
    if [ -n "$SERVICE_URL" ]; then
        echo ""
        echo "🔗 Service URL: $SERVICE_URL"
    fi
    
else
    echo "❌ Service $SERVICE_NAME does not exist in $REGION"
    echo "💡 Try deploying first with: ./deploy-simple.sh"
fi
echo ""

# Check recent logs if service exists
echo "6. 📋 Recent logs (last 10 lines)..."
gcloud run services logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID --limit=10 2>/dev/null || echo "No logs available or service doesn't exist"
echo ""

# Check Docker authentication
echo "7. 🐳 Checking Docker authentication..."
if docker info >/dev/null 2>&1; then
    echo "✅ Docker is running"
    if gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin https://gcr.io >/dev/null 2>&1; then
        echo "✅ Docker authenticated with GCR"
    else
        echo "❌ Docker not authenticated with GCR. Run: gcloud auth configure-docker"
    fi
else
    echo "❌ Docker is not running or not installed"
fi
echo ""

# Check if image exists in Container Registry
echo "8. 📦 Checking Container Registry..."
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"
if gcloud container images list --repository=gcr.io/$PROJECT_ID --filter="name:$IMAGE_NAME" --format="value(name)" | grep -q "$SERVICE_NAME"; then
    echo "✅ Image exists in Container Registry"
    echo "Latest tags:"
    gcloud container images list-tags $IMAGE_NAME --limit=3 --format="table(tags,timestamp)"
else
    echo "❌ No image found in Container Registry"
    echo "💡 The image will be built during deployment"
fi
echo ""

echo "🎯 Recommended next steps:"
echo "1. If authentication issues: gcloud auth login"
echo "2. If project issues: gcloud config set project $PROJECT_ID"
echo "3. If API issues: gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com"
echo "4. If no service exists: ./deploy-simple.sh"
echo "5. If service exists but not working: Check logs and environment variables"
echo ""
echo "🆘 For more help:"
echo "- View in console: https://console.cloud.google.com/run?project=$PROJECT_ID"
echo "- Check logs: gcloud run services logs read $SERVICE_NAME --region $REGION"
echo "- Describe service: gcloud run services describe $SERVICE_NAME --region $REGION"