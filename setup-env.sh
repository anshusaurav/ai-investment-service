#!/bin/bash

# Safe Environment Setup Script
# This script helps set up environment variables without exposing secrets

set -e

echo "🔧 Setting up environment variables safely..."

# Check if .env exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. Creating backup..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Create .env template if it doesn't exist
if [ ! -f ".env.template" ]; then
    echo "📝 Creating .env.template..."
    cat > .env.template << 'EOF'
# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id

# IMPORTANT: Never commit the actual service account key!
# Use: gcloud iam service-accounts keys create key.json --iam-account=your-service-account
# Then: export FIREBASE_SERVICE_ACCOUNT_KEY="$(cat key.json)"
FIREBASE_SERVICE_ACCOUNT_KEY=

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10000
AUTH_RATE_LIMIT_MAX_REQUESTS=50

# API Keys (use environment variables or secret manager)
GEMINI_API_KEY=

# MongoDB Configuration
MONGODB_URI=
MONGODB_DATABASE=
MONGODB_COLLECTION=
EOF
fi

echo "✅ Environment template created at .env.template"
echo ""
echo "🔐 Security Reminders:"
echo "1. Never commit .env files to version control"
echo "2. Use 'gcloud auth application-default login' for local development when possible"
echo "3. For production, use managed identities or secret managers"
echo "4. Rotate service account keys regularly"
echo ""
echo "📋 Next steps:"
echo "1. Copy .env.template to .env"
echo "2. Fill in your actual values in .env"
echo "3. For Firebase, either:"
echo "   a) Use: gcloud auth application-default login"
echo "   b) Create a service account key and set FIREBASE_SERVICE_ACCOUNT_KEY"
echo ""
echo "🚨 Remember: .env files are in .gitignore and should NEVER be committed!"