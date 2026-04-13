# Security Pre-Push Checklist

**Run this checklist before every push to GitHub to prevent security regressions.**

---

## Automated Checks

### 1. Run Security Scanner

```bash
npm run test:security
```

**What it checks:**
- ✅ No hardcoded API keys (Groq, Stripe, Resend, Google, Webhook secrets)
- ✅ No hardcoded PII (credit cards, SSNs, email addresses)
- ✅ No email placeholders in production code

**Expected result:** ✅ Zero violations

**If it fails:**
- Review the reported files and line numbers
- Remove or move secrets to `.env` file
- Replace hardcoded values with environment variables

---

## Manual Checks

### 2. Verify .gitignore Coverage

```bash
# Check that sensitive files are ignored
git check-ignore .env dev.db prisma/dev.db
```

**Expected result:** All three files should be listed (meaning they're ignored)

**If it fails:**
- Verify `.gitignore` contains `.env*` and `*.db` patterns
- Run `git rm --cached <file>` to untrack any tracked sensitive files

---

### 3. Check for Tracked Sensitive Files

```bash
# Verify no sensitive files are tracked
git ls-files | grep -E '\.(env|db)$'
```

**Expected result:** No output (no .env or .db files tracked)

**If it fails:**
- Run `git rm --cached <file>` to untrack the file
- Verify the file is in `.gitignore`

---

### 4. Review Staged Changes

```bash
# See what you're about to commit
git diff --cached
```

**Manual review checklist:**
- ❌ No API keys or secrets in code
- ❌ No hardcoded email addresses or customer IDs
- ❌ No database connection strings
- ❌ No webhook secrets or signing keys
- ❌ No authentication tokens
- ✅ Only placeholder values in example files

---

### 5. Verify NEXT_PUBLIC_ Variables

```bash
# List all NEXT_PUBLIC_ variables
grep -r "NEXT_PUBLIC_" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

**Manual review:**
- ✅ Only safe values (product IDs, public URLs, publishable keys)
- ❌ No secret keys, API keys, or webhook secrets

**Safe NEXT_PUBLIC_ variables:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` ✅
- `NEXT_PUBLIC_DODO_*_PRODUCT_ID` ✅
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` ✅
- `NEXT_PUBLIC_APP_URL` ✅

**NEVER use NEXT_PUBLIC_ for:**
- `CLERK_SECRET_KEY` ❌
- `GROQ_API_KEY` ❌
- `DATABASE_URL` ❌
- Any webhook secrets ❌

---

### 6. Check Debug Endpoints

**Verify these endpoints are secured:**

```bash
# Should require admin auth
curl http://localhost:3000/api/llm/metrics
curl http://localhost:3000/api/llm/status
curl http://localhost:3000/api/health/billing

# Should return 404 in production
curl http://localhost:3000/api/test-rewrite-health
```

**Expected results:**
- Monitoring endpoints: HTTP 401 (Unauthorized) without admin auth
- Test endpoint: HTTP 404 in production, HTTP 200 in development

---

### 7. Check Cron Endpoints

**Verify cron endpoints require authentication:**

```bash
# Should return 401 without CRON_SECRET
curl http://localhost:3000/api/cron/keep-alive
curl http://localhost:3000/api/cron/normalize-subscriptions
```

**Expected result:** HTTP 401 (Unauthorized) or HTTP 503 (if CRON_SECRET not configured)

---

### 8. Test File Upload Validation

**Verify MIME type and size validation:**

```bash
# Test with a large file (should reject with 413)
# Test with wrong file type (should reject with 400)
```

**Expected results:**
- Files >50MB (documents) or >100MB (audio): HTTP 413
- Invalid file types (e.g., .exe renamed to .pdf): HTTP 400

---

## Pre-Push Command Summary

**Quick checklist (run all at once):**

```bash
# 1. Run security scanner
npm run test:security

# 2. Check gitignore
git check-ignore .env dev.db prisma/dev.db

# 3. Check for tracked sensitive files
git ls-files | grep -E '\.(env|db)$'

# 4. Review staged changes
git diff --cached

# 5. Verify no secrets in NEXT_PUBLIC_ variables
grep -r "NEXT_PUBLIC_" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

---

## Common Issues and Fixes

### Issue: Security scanner finds API keys in code

**Fix:**
1. Move the key to `.env` file
2. Reference it as `process.env.YOUR_KEY_NAME`
3. Add the key name to `.env.example` with a placeholder value

### Issue: .env file is tracked by git

**Fix:**
```bash
git rm --cached .env
git commit -m "security: Untrack .env file"
```

### Issue: Hardcoded email in scripts

**Fix:**
1. Update script to read from `process.env` or `process.argv`
2. Add usage message when argument is missing
3. Document the environment variable in `.env.example`

### Issue: Debug endpoint accessible in production

**Fix:**
1. Add environment check: `if (process.env.NODE_ENV === 'production') return 404`
2. Or add admin authentication using `requireAdmin()` from `@/lib/admin`

---

## Emergency: Secrets Already Committed

If you accidentally committed secrets:

1. **Immediately rotate the exposed secrets** (see `SECRETS_ROTATION.md`)
2. **Remove from git history:**
   ```bash
   # WARNING: This rewrites history - coordinate with team
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. **Force push** (if repository is private and you're the only contributor):
   ```bash
   git push origin --force --all
   ```
4. **Verify secrets are rotated** before anyone can use the old ones

---

## Best Practices

1. ✅ **Always run `npm run test:security` before committing**
2. ✅ **Review `git diff --cached` before every commit**
3. ✅ **Use `.env.example` for documentation, never commit `.env`**
4. ✅ **Use environment variables for all secrets**
5. ✅ **Never hardcode customer data (emails, IDs, etc.)**
6. ✅ **Test authentication on debug/admin endpoints**
7. ✅ **Rotate secrets quarterly as preventive maintenance**

---

**Last Updated:** [Date]  
**Next Review:** [Date + 30 days]
