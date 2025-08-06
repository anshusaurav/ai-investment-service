# 🔐 Security Guide

## Quick Start (Secure Setup)

### 1. Local Development
```bash
# Clone the repository
git clone <your-repo>
cd ai-investment-service

# Set up environment safely
./setup-env.sh

# Use application default credentials (recommended)
gcloud auth application-default login

# Or manually set up .env (never commit this file)
cp .env.template .env
# Edit .env with your values
```

### 2. Production Deployment
```bash
# Set up secrets in Google Secret Manager
./setup-production-secrets.sh

# Deploy using Cloud Build
gcloud builds submit --config cloudbuild.yaml
```

## 🛡️ Security Features

### Automatic Protection
- ✅ Pre-commit hooks prevent accidental credential commits
- ✅ .gitignore protects sensitive files
- ✅ Environment variables are never logged
- ✅ Service account keys stored in Secret Manager for production

### Manual Verification
```bash
# Check what files would be committed
git status

# Verify no secrets in staged changes
git diff --cached

# Test the pre-commit hook
git add . && git commit -m "test" --dry-run
```

## 🚨 What to Do If Keys Are Exposed

### Immediate Response (< 5 minutes)
```bash
# 1. Disable the exposed key immediately
gcloud iam service-accounts keys delete KEY_ID \
    --iam-account=firebase-adminsdk-d93k8@screener-specter.iam.gserviceaccount.com

# 2. Create a new key
gcloud iam service-accounts keys create new-key.json \
    --iam-account=firebase-adminsdk-d93k8@screener-specter.iam.gserviceaccount.com

# 3. Update your environment
export FIREBASE_SERVICE_ACCOUNT_KEY="$(cat new-key.json)"

# 4. Clean up
rm new-key.json
```

### Follow-up Actions (< 1 hour)
1. Check audit logs for unauthorized usage
2. Update production secrets if needed
3. Review and strengthen security measures
4. Document the incident

## 📋 Security Checklist

### Before Every Commit
- [ ] No credentials in source code
- [ ] .env files not staged for commit
- [ ] Pre-commit hook passes
- [ ] Secrets use environment variables

### Before Every Deployment
- [ ] Secrets stored in Secret Manager
- [ ] Service account has minimal permissions
- [ ] Audit logging enabled
- [ ] Monitoring alerts configured

### Monthly Security Review
- [ ] Rotate service account keys
- [ ] Review IAM permissions
- [ ] Check audit logs for anomalies
- [ ] Update security documentation

## 🔧 Security Tools

### Included Scripts
- `setup-env.sh` - Safe environment setup
- `setup-production-secrets.sh` - Production secret management
- `validate-service-account.js` - Test Firebase credentials
- `test-firebase.js` - Comprehensive connection test

### Git Hooks
- Pre-commit hook prevents credential commits
- Scans for sensitive patterns in files and content

### Monitoring
```bash
# Check recent service account activity
gcloud logging read 'protoPayload.authenticationInfo.principalEmail="firebase-adminsdk-d93k8@screener-specter.iam.gserviceaccount.com"' \
    --limit=50

# Monitor secret access
gcloud logging read 'protoPayload.serviceName="secretmanager.googleapis.com"' \
    --limit=20
```

## 📚 Additional Resources

- [SECURITY.md](./SECURITY.md) - Comprehensive security guide
- [DEPLOYMENT-SECURITY.md](./DEPLOYMENT-SECURITY.md) - Secure deployment practices
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

## 🆘 Emergency Contacts

If you discover a security issue:
1. **DO NOT** commit or push any fixes that might expose more information
2. Disable affected credentials immediately
3. Contact the security team
4. Follow the incident response procedures in SECURITY.md

---

**Remember**: Security is everyone's responsibility. When in doubt, ask for help!