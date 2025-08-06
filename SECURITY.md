# Security Best Practices

## 🔐 Protecting Service Account Keys

### ❌ What NOT to do:
- Never commit service account keys to version control
- Don't put credentials in environment files that get committed
- Avoid hardcoding credentials in source code
- Don't share keys via email, Slack, or other messaging platforms

### ✅ What TO do:

#### 1. Local Development
- Use `.env` files (already in .gitignore)
- Store keys as environment variables
- Use `gcloud auth application-default login` when possible

#### 2. Production Deployment
- **Google Cloud Run**: Use built-in service accounts or Workload Identity
- **Other platforms**: Use secret management services
- **Docker**: Use Docker secrets or external secret managers

#### 3. Key Management
- Rotate keys regularly (every 90 days recommended)
- Use least-privilege principle (minimal required permissions)
- Monitor key usage with Cloud Audit Logs

## 🛡️ Current Security Measures

### Environment Protection
```bash
# These files are protected by .gitignore:
.env*
serviceAccountKey.json
*-key.json
*-credentials.json
```

### Firebase Configuration
- Service account has minimal required permissions:
  - `roles/datastore.owner` (Firestore access)
  - `roles/firebase.sdkAdminServiceAgent` (Firebase SDK)
  - `roles/firebaseauth.admin` (Authentication)

## 🚨 If Keys Are Exposed

### Immediate Actions:
1. **Disable the key immediately**:
   ```bash
   gcloud iam service-accounts keys delete KEY_ID \
     --iam-account=SERVICE_ACCOUNT_EMAIL
   ```

2. **Create a new key**:
   ```bash
   gcloud iam service-accounts keys create new-key.json \
     --iam-account=SERVICE_ACCOUNT_EMAIL
   ```

3. **Update environment variables**
4. **Check audit logs for unauthorized usage**
5. **Rotate any other potentially compromised credentials**

## 🔍 Detection & Monitoring

### GitHub Secret Scanning
- GitHub automatically scans for exposed secrets
- Google Cloud also monitors for exposed keys
- Set up alerts for suspicious activity

### Regular Audits
- Review service account permissions quarterly
- Check key usage in Cloud Console
- Monitor authentication logs

## 📋 Deployment Checklist

### Before Deploying:
- [ ] Verify .env files are in .gitignore
- [ ] Check no credentials in source code
- [ ] Use environment variables for all secrets
- [ ] Test with minimal permissions first
- [ ] Set up monitoring and alerts

### Production Setup:
- [ ] Use managed identity when possible
- [ ] Implement secret rotation
- [ ] Set up audit logging
- [ ] Configure least-privilege access
- [ ] Document emergency procedures

## 🔧 Tools & Commands

### Check for exposed secrets:
```bash
# Scan git history for potential secrets
git log --all --full-history -- .env*
git log --all --full-history -- "*key*.json"

# Use git-secrets (install first)
git secrets --scan
```

### Service Account Management:
```bash
# List service accounts
gcloud iam service-accounts list

# List keys for a service account
gcloud iam service-accounts keys list \
  --iam-account=SERVICE_ACCOUNT_EMAIL

# Delete a key
gcloud iam service-accounts keys delete KEY_ID \
  --iam-account=SERVICE_ACCOUNT_EMAIL
```

## 📞 Emergency Contacts

If you suspect a security breach:
1. Disable affected credentials immediately
2. Check audit logs for unauthorized access
3. Rotate all potentially affected secrets
4. Review and update security measures

---

**Remember**: Security is an ongoing process, not a one-time setup!