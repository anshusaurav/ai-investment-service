#!/bin/bash

# Script to set environment variables for the deployed Cloud Run service

# Set variables - REPLACE WITH YOUR ACTUAL PROJECT ID
PROJECT_ID="specter-fi"  # Replace this with your actual GCP project ID
SERVICE_NAME="ai-investment-service"
REGION="us-central1"

echo "🔧 Setting environment variables for Cloud Run service..."

# Set MongoDB and basic configuration
echo "📊 Setting MongoDB and basic configuration..."
gcloud run services update $SERVICE_NAME \
  --set-env-vars \
  MONGODB_URI="mongodb+srv://25f1002017:VvD0Vr7Yl4mt9FLr@cluster0.3zoskau.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",\
  MONGODB_DATABASE=specter-db,\
  MONGODB_COLLECTION=companies \
  --region $REGION \
  --project $PROJECT_ID

if [ $? -eq 0 ]; then
    echo "✅ MongoDB configuration set successfully"
else
    echo "❌ Failed to set MongoDB configuration"
    exit 1
fi

# Set Firebase and other configurations
echo "🔥 Setting Firebase and other configurations..."
gcloud run services update $SERVICE_NAME \
  --set-env-vars \
  FIREBASE_PROJECT_ID=screener-specter,\
  GEMINI_API_KEY=AIzaSyBPFPSoEAdbsNTCVaZywU0Eq2A4Q_ERDnU,\
  ALLOWED_ORIGINS="https://your-frontend-domain.com,http://localhost:3000" \
  --region $REGION \
  --project $PROJECT_ID

if [ $? -eq 0 ]; then
    echo "✅ Firebase and other configurations set successfully"
else
    echo "❌ Failed to set Firebase configuration"
    exit 1
fi

# Set Firebase Service Account using Secret Manager (more secure)
echo "🔐 Setting up Firebase Service Account Key..."
echo "Creating secret for Firebase service account..."

# Create the secret (you'll need to replace this with your actual Firebase service account JSON)
cat > /tmp/firebase-key.json << 'EOF'
{
  "type": "service_account",
  "project_id": "screener-specter",
  "private_key_id": "c84124210a82bc36bd55e3412573c1da0a26c29d",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD0tHqb2lC2+c5A\n2jB1aul67zEF2z+9zxfjwBOHQF78uH5HyciQnWyxswwEpQwJXNMe0PEB5+NEMM5M\nrM6NoEsrOMpypcUOOB0UjZDP8m5c5A4vVnUUK231wSm3ZkyOO2zoXvL1C9jepolR\nSoD9rMVgj8f+IFdmFX5K1Krn06GRKFD1V7VHXacjmU9gRsnf4S25lyErTFnd2fxr\nI5olImLPAnzmuluTjpB1mYSRmDnRq44jWZWNxP13Gp7+4BfNke+EsyE5pL40apEm\n8yXOyi2/yOGFPanUCftG8zEZik9Isg4ILZQK9tADWJBUOhUNc6DoH4wFRXqJtQbu\nfP80DWglAgMBAAECggEAAxRtwfNmoP7ri8u94LnGlCpZgsTb0a7pvTnoJQN4OT8L\nMSpxe0cinJPvz/PR1HZWHo+rpjCodBhsfZuOgqAkrLfAwzOh6MgSWaAJ1WGBkRVl\nC6R6FxW62GUkz27wAg7uaSL0yi/AJtaQE4qtV+6qPJ5ipSimtkgJTbYigTDGhPX8\nzZczDFc2dk44yjvDWujXryIa7QQA0LqzFLIu2KfvFmavtOsWbxXMslpLpGgpkXCD\nLbhpAYOZVMtlIZozRkJbwoW3+GFfJFO5Rh61fmU/sTHuoTNXLrw5cHoquehqY7GD\n9ztFXz12d2WCwBjWogRfIwm/xfcI7iS6Mb0afVtq6wKBgQD/+N5UvxPXhhd6P10T\nLE4K43/+7wYW0cMhKDQVKXs5mFhWY0xomaGINOU6pKPsAE2v01/jkcCNdF//bDyz\naIfVy+wVDzmJv8eh3d0onWrkiei8SiwDyltDZ4+Y2CXo+0xe6vDOZ7o08N/oUF7m\nIjzNieO4MJFmITCnkc5HPDRpiwKBgQD0u0vqybHLAX3EpC5hZpgtIzrb86vAkdov\n65bYXb65lbTtlJ17HxjpyiWgJPv3qOQDYW6HiiHd6ccc26Bg48hZR8Jk84h5z/o4\nN92skZ0gAD9Gc05cgmRU2uhRANgFpCyHABfObYsDMRnlvpC6RCHugFuLFk1HGQO5\ne2t0HR7LDwKBgQCqM5faL+eIon/P6HwB+K637Me6AsNAvx+JV4syGw/1nwf2ATbY\nQnc28z0MvlbE4PrHE7ypu8uWAzClzRmbjcDsdxi2dBYlMuESD00z6WAfMFgRgxw7\nNP10F1NTJT4n6ZjBcGTISg51j0jC11YSnediH/LMEXdMunr4oSnREgYjuwKBgQDj\nRxm+5yctb6ocN5k3LW8/5Arif85OnWUywaiqMY1Rjr2jMjR6Riv92pTMv+wcWQXA\nOfjK+TZwf45Bt5mewYurll/rHtvsvIAVO5SrkeOI95HL3IO2mAWTZGUB7TWxL4GG\nskhplgPWp//0A+EmiuW0OBJL/h8wWwPBeuQUxoJ1cwKBgFR10T2KXzXUa4N1aJaf\neI44MsHAOHSEcs6rNAcBfbHY663jLYp4iijR0d/ucw7KFvwUdwOEAKHI36r4oebk\nAudNx/tuy6GVy6U+ZoQFGJnOSge8F052xZ0kTRN1LZDuz7JWfhzQIx5JsuQEHyYI\nCo7DTWqUB8bMLdGFfwpoX1bI\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-d93k8@screener-specter.iam.gserviceaccount.com",
  "client_id": "101052735260223925759",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-d93k8%40screener-specter.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
EOF

# Create or update the secret
gcloud secrets create firebase-service-account --data-file=/tmp/firebase-key.json --project $PROJECT_ID 2>/dev/null || \
gcloud secrets versions add firebase-service-account --data-file=/tmp/firebase-key.json --project $PROJECT_ID

if [ $? -eq 0 ]; then
    echo "✅ Firebase service account secret created/updated"
    
    # Update the service to use the secret
    gcloud run services update $SERVICE_NAME \
      --set-secrets FIREBASE_SERVICE_ACCOUNT_KEY=firebase-service-account:latest \
      --region $REGION \
      --project $PROJECT_ID
    
    if [ $? -eq 0 ]; then
        echo "✅ Firebase service account secret configured for Cloud Run"
    else
        echo "❌ Failed to configure Firebase service account secret"
    fi
else
    echo "❌ Failed to create Firebase service account secret"
fi

# Clean up temporary file
rm -f /tmp/firebase-key.json

echo ""
echo "✅ Environment variables setup completed!"
echo ""
echo "🔍 Verify your configuration:"
echo "gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID"
echo ""
echo "🧪 Test your service:"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --project $PROJECT_ID --format 'value(status.url)' 2>/dev/null)
if [ -n "$SERVICE_URL" ]; then
    echo "curl $SERVICE_URL/health"
    echo "curl -X POST $SERVICE_URL/api/company/search -H 'Content-Type: application/json' -d '{\"q\": \"Carysil\"}'"
fi