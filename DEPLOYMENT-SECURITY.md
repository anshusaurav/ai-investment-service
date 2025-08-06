# Secure Deployment Guide

## 🚀 Production Deployment Security

### Option 1: Google Cloud Run (Recommended)

#### Using Workload Identity (Most Secure)
```bash
# 1. Enable Workload Identity
gcloud container clusters update CLUSTER_NAME \
    --workload-pool=PROJECT_ID.svc.id.goog

# 2. Create Kubernetes Service Account
kubectl create serviceaccount KSA_NAME

# 3. Bind to Google Service Account
gcloud iam service-accounts add-iam-policy-binding \
    --role roles/iam.workloadIdentityUser \
    --member "serviceAccount:PROJECT_ID.svc.id.goog[NAMESPACE/KSA_NAME]" \
    GSA_NAME@PROJECT_ID.iam.gserviceaccount.com

# 4. Deploy without service account key
gcloud run deploy ai-investment-service \
    --image gcr.io/PROJECT_ID/ai-investment-service \
    --service-account=GSA_NAME@PROJECT_ID.iam.gserviceaccount.com
```

#### Using Secret Manager (Alternative)
```bash
# 1. Store service account key in Secret Manager
gcloud secrets create firebase-service-account-key \
    --data-file=service-account-key.json

# 2. Grant access to Cloud Run service
gcloud secrets add-iam-policy-binding firebase-service-account-key \
    --member="serviceAccount:CLOUD_RUN_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"

# 3. Mount secret in Cloud Run
gcloud run deploy ai-investment-service \
    --image gcr.io/PROJECT_ID/ai-investment-service \
    --update-secrets=FIREBASE_SERVICE_ACCOUNT_KEY=firebase-service-account-key:latest
```

### Option 2: Other Cloud Providers

#### AWS
```bash
# Use AWS Secrets Manager
aws secretsmanager create-secret \
    --name firebase-service-account-key \
    --secret-string file://service-account-key.json

# In your application, retrieve from Secrets Manager
# Don't use environment variables for secrets in production
```

#### Azure
```bash
# Use Azure Key Vault
az keyvault secret set \
    --vault-name YOUR_VAULT \
    --name firebase-service-account-key \
    --file service-account-key.json
```

## 🔒 Environment Variable Security

### Development
```bash
# Use application default credentials when possible
gcloud auth application-default login

# Or use environment variables (never commit these)
export FIREBASE_SERVICE_ACCOUNT_KEY="$(cat service-account-key.json)"
```

### Production
```bash
# ❌ DON'T DO THIS - Environment variables can be exposed
export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# ✅ DO THIS - Use secret management services
# Mount secrets as files or use managed identity
```

## 🛡️ Security Checklist

### Pre-Deployment
- [ ] Remove all hardcoded credentials
- [ ] Verify .gitignore includes all sensitive files
- [ ] Test with minimal IAM permissions
- [ ] Enable audit logging
- [ ] Set up monitoring alerts

### Deployment
- [ ] Use managed identity when possible
- [ ] Store secrets in dedicated secret management service
- [ ] Enable HTTPS/TLS encryption
- [ ] Configure proper CORS settings
- [ ] Set up rate limiting

### Post-Deployment
- [ ] Verify no credentials in logs
- [ ] Test authentication flows
- [ ] Monitor for suspicious activity
- [ ] Set up automated security scanning
- [ ] Document incident response procedures

## 🔄 Key Rotation Strategy

### Automated Rotation (Recommended)
```bash
# Create rotation script
#!/bin/bash
OLD_KEY_ID=$(gcloud iam service-accounts keys list \
    --iam-account=SERVICE_ACCOUNT_EMAIL \
    --format="value(name)" | head -1)

# Create new key
gcloud iam service-accounts keys create new-key.json \
    --iam-account=SERVICE_ACCOUNT_EMAIL

# Update secret in Secret Manager
gcloud secrets versions add firebase-service-account-key \
    --data-file=new-key.json

# Wait for deployment to pick up new key
sleep 300

# Delete old key
gcloud iam service-accounts keys delete $OLD_KEY_ID \
    --iam-account=SERVICE_ACCOUNT_EMAIL \
    --quiet

# Clean up local file
rm new-key.json
```

### Manual Rotation (Every 90 days)
1. Create new service account key
2. Update secret management service
3. Deploy updated configuration
4. Verify new key works
5. Delete old key
6. Update documentation

## 🚨 Incident Response

### If Credentials Are Compromised:
1. **Immediate**: Disable/delete the compromised key
2. **Within 1 hour**: Create and deploy new credentials
3. **Within 24 hours**: Review audit logs for unauthorized access
4. **Within 1 week**: Conduct security review and update procedures

### Emergency Commands:
```bash
# List all keys for service account
gcloud iam service-accounts keys list \
    --iam-account=SERVICE_ACCOUNT_EMAIL

# Delete compromised key immediately
gcloud iam service-accounts keys delete KEY_ID \
    --iam-account=SERVICE_ACCOUNT_EMAIL \
    --quiet

# Check recent activity
gcloud logging read "protoPayload.serviceName=iam.googleapis.com" \
    --limit=50 \
    --format=json
```

## 📊 Monitoring & Alerting

### Set up alerts for:
- New service account key creation
- Unusual API access patterns
- Failed authentication attempts
- Service account permission changes

### Useful queries:
```bash
# Monitor service account usage
gcloud logging read 'protoPayload.authenticationInfo.principalEmail="SERVICE_ACCOUNT_EMAIL"' \
    --limit=100

# Check for permission escalations
gcloud logging read 'protoPayload.serviceName="iam.googleapis.com" AND protoPayload.methodName="SetIamPolicy"' \
    --limit=50
```

---

**Remember**: Security is not a destination, it's a journey. Regularly review and update your security practices!