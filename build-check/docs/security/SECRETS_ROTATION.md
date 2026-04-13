# Secrets Rotation Checklist

**CRITICAL**: All secrets in the `.env` file have been exposed and MUST be rotated immediately before deploying to production.

## Rotation Status

| Secret | Priority | Status | Rotated Date | Notes |
|--------|----------|--------|--------------|-------|
| DATABASE_URL | 🔴 CRITICAL | ⏳ Pending | - | Neon database connection string |
| CLERK_SECRET_KEY | 🔴 CRITICAL | ⏳ Pending | - | Authentication backend key |
| CLERK_WEBHOOK_SIGNING_SECRET | 🔴 CRITICAL | ⏳ Pending | - | Webhook signature verification |
| GROQ_API_KEY | 🔴 CRITICAL | ⏳ Pending | - | LLM provider API key |
| GOOGLE_GENERATIVE_AI_API_KEY | 🔴 CRITICAL | ⏳ Pending | - | Gemini API key |
| DEEPGRAM_API_KEY | 🔴 CRITICAL | ⏳ Pending | - | Audio transcription API key |
| RESEND_API_KEY | 🔴 CRITICAL | ⏳ Pending | - | Email sending API key |
| DODO_PAYMENTS_API_KEY (test) | 🟠 HIGH | ⏳ Pending | - | Test mode payment key |
| DODO_PAYMENTS_API_KEY (live) | 🔴 CRITICAL | ⏳ Pending | - | Production payment key |
| DODO_PAYMENTS_WEBHOOK_KEY (test) | 🟠 HIGH | ⏳ Pending | - | Test webhook secret |
| DODO_PAYMENTS_WEBHOOK_KEY (live) | 🔴 CRITICAL | ⏳ Pending | - | Production webhook secret |
| PAYPAL_CLIENT_SECRET | 🔴 CRITICAL | ⏳ Pending | - | PayPal API secret |
| UPSTASH_REDIS_REST_TOKEN | 🔴 CRITICAL | ⏳ Pending | - | Redis authentication token |
| CRON_SECRET | 🟠 HIGH | ⏳ Pending | - | Cron job authentication |
| SUPADATA_API_KEY | 🟡 MEDIUM | ⏳ Pending | - | YouTube transcript API |
| DISCORD_BUGREPORTS_WEBHOOK_URL | 🟡 MEDIUM | ⏳ Pending | - | Discord notification webhook |
| DISCORD_FEEDBACKS_WEBHOOK_URL | 🟡 MEDIUM | ⏳ Pending | - | Discord notification webhook |

---

## Rotation Instructions

### 1. DATABASE_URL (Neon PostgreSQL)

**Priority**: 🔴 CRITICAL

**Steps**:
1. Log in to [Neon Console](https://console.neon.tech/)
2. Navigate to your project → Settings → Connection Details
3. Click "Reset password" to generate a new database password
4. Copy the new connection string
5. Update `DATABASE_URL` in production environment variables
6. Test database connectivity: `npx prisma db pull`
7. Verify old connection string no longer works

**Verification**:
```bash
# Test new connection
npx prisma db pull

# Should fail with old credentials
DATABASE_URL="<old_url>" npx prisma db pull
```

---

### 2. CLERK_SECRET_KEY & CLERK_WEBHOOK_SIGNING_SECRET

**Priority**: 🔴 CRITICAL

**Steps**:
1. Log in to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Navigate to your application → API Keys
3. Click "Regenerate" next to Secret Key
4. Copy the new secret key
5. Navigate to Webhooks → Select your webhook endpoint
6. Click "Regenerate signing secret"
7. Copy the new webhook signing secret
8. Update both `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SIGNING_SECRET` in production
9. Test authentication flow

**Verification**:
```bash
# Test authentication with new key
curl -H "Authorization: Bearer <new_clerk_secret>" \
  https://api.clerk.com/v1/users
```

---

### 3. GROQ_API_KEY

**Priority**: 🔴 CRITICAL

**Steps**:
1. Log in to [Groq Console](https://console.groq.com/)
2. Navigate to API Keys
3. Delete the exposed key
4. Click "Create API Key"
5. Copy the new key
6. Update `GROQ_API_KEY` in production environment variables
7. Test LLM generation endpoint

**Verification**:
```bash
# Test new key
curl -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer <new_groq_key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"test"}]}'
```

---

### 4. GOOGLE_GENERATIVE_AI_API_KEY

**Priority**: 🔴 CRITICAL

**Steps**:
1. Log in to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Find the exposed API key and click "Delete"
4. Click "Create Credentials" → "API Key"
5. Restrict the key to Generative Language API only
6. Copy the new key
7. Update `GOOGLE_GENERATIVE_AI_API_KEY` in production

**Verification**:
```bash
# Test new key
curl "https://generativelanguage.googleapis.com/v1beta/models?key=<new_key>"
```

---

### 5. DEEPGRAM_API_KEY

**Priority**: 🔴 CRITICAL

**Steps**:
1. Log in to [Deepgram Console](https://console.deepgram.com/)
2. Navigate to API Keys
3. Delete the exposed key
4. Click "Create a New API Key"
5. Copy the new key
6. Update `DEEPGRAM_API_KEY` in production

**Verification**:
```bash
# Test new key
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token <new_deepgram_key>" \
  -H "Content-Type: audio/wav" \
  --data-binary @test.wav
```

---

### 6. RESEND_API_KEY

**Priority**: 🔴 CRITICAL

**Steps**:
1. Log in to [Resend Dashboard](https://resend.com/api-keys)
2. Delete the exposed API key
3. Click "Create API Key"
4. Copy the new key
5. Update `RESEND_API_KEY` in production
6. Test email sending

**Verification**:
```bash
# Test new key
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer <new_resend_key>" \
  -H "Content-Type: application/json" \
  -d '{"from":"test@yourdomain.com","to":"test@example.com","subject":"Test","html":"Test"}'
```

---

### 7. DODO_PAYMENTS_API_KEY & DODO_PAYMENTS_WEBHOOK_KEY

**Priority**: 🔴 CRITICAL (live), 🟠 HIGH (test)

**Steps**:
1. Log in to [Dodo Payments Dashboard](https://dashboard.dodopayments.com/)
2. Navigate to Developers → API Keys
3. Delete the exposed keys (both test and live mode)
4. Generate new API keys for both test and live modes
5. Navigate to Webhooks → Regenerate signing secrets
6. Update all four values in production:
   - `DODO_PAYMENTS_API_KEY` (test)
   - `DODO_PAYMENTS_API_KEY` (live)
   - `DODO_PAYMENTS_WEBHOOK_KEY` (test)
   - `DODO_PAYMENTS_WEBHOOK_KEY` (live)

**Verification**:
```bash
# Test new API key
curl -X GET https://api.dodopayments.com/v1/products \
  -H "Authorization: Bearer <new_dodo_key>"
```

---

### 8. PAYPAL_CLIENT_SECRET

**Priority**: 🔴 CRITICAL

**Steps**:
1. Log in to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Navigate to Apps & Credentials
3. Select your app
4. Click "Show" next to Secret
5. Click "Reset Secret"
6. Copy the new secret
7. Update `PAYPAL_CLIENT_SECRET` in production

**Verification**:
```bash
# Test new credentials
curl -X POST https://api-m.paypal.com/v1/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "<client_id>:<new_secret>" \
  -d "grant_type=client_credentials"
```

---

### 9. UPSTASH_REDIS_REST_TOKEN

**Priority**: 🔴 CRITICAL

**Steps**:
1. Log in to [Upstash Console](https://console.upstash.com/)
2. Select your Redis database
3. Navigate to Details → REST API
4. Click "Regenerate Token"
5. Copy the new token
6. Update `UPSTASH_REDIS_REST_TOKEN` in production

**Verification**:
```bash
# Test new token
curl -X POST <UPSTASH_REDIS_REST_URL>/ping \
  -H "Authorization: Bearer <new_token>"
```

---

### 10. CRON_SECRET

**Priority**: 🟠 HIGH

**Steps**:
1. Generate a new secure random secret:
   ```bash
   openssl rand -base64 32
   ```
2. Update `CRON_SECRET` in production environment variables
3. Update Vercel Cron configuration if using Vercel Cron
4. Test cron endpoints with new secret

**Verification**:
```bash
# Test new secret
curl -X GET https://yourdomain.com/api/cron/keep-alive \
  -H "Authorization: Bearer <new_cron_secret>"
```

---

### 11. SUPADATA_API_KEY

**Priority**: 🟡 MEDIUM

**Steps**:
1. Log in to [Supadata Dashboard](https://supadata.ai/)
2. Navigate to API Keys
3. Delete the exposed key
4. Generate a new API key
5. Update `SUPADATA_API_KEY` in production

---

### 12. Discord Webhook URLs

**Priority**: 🟡 MEDIUM

**Steps**:
1. Open Discord → Server Settings → Integrations → Webhooks
2. Delete the exposed webhooks
3. Create new webhooks for bug reports and feedback
4. Copy the new webhook URLs
5. Update `DISCORD_BUGREPORTS_WEBHOOK_URL` and `DISCORD_FEEDBACKS_WEBHOOK_URL`

---

## Post-Rotation Checklist

After rotating all secrets:

- [ ] All production environment variables updated
- [ ] All staging environment variables updated
- [ ] All development team members notified
- [ ] Old secrets verified as non-functional
- [ ] Application tested end-to-end with new secrets
- [ ] Monitoring alerts configured for authentication failures
- [ ] This document updated with rotation dates
- [ ] `.env` file deleted from local machines (use `.env.example` as template)
- [ ] Git history cleaned (if secrets were committed)

---

## Emergency Contact

If you suspect active exploitation of exposed secrets:

1. **Immediately rotate all CRITICAL secrets**
2. **Review audit logs** for suspicious activity
3. **Check billing** for unexpected API usage
4. **Monitor database** for unauthorized access
5. **Contact support** for each affected service

---

## Prevention

To prevent future secret exposure:

1. ✅ Never commit `.env` files (already in `.gitignore`)
2. ✅ Use `.env.example` with placeholder values only
3. ✅ Run `npm run test:security` before every commit
4. ✅ Set up pre-push git hook to block secret commits
5. ✅ Use environment variables in CI/CD, never hardcode
6. ✅ Rotate secrets quarterly as a best practice
7. ✅ Use secret management tools (AWS Secrets Manager, Vault) for production

---

**Last Updated**: [Date]  
**Next Scheduled Rotation**: [Date + 90 days]
