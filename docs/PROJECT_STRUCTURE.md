# Project Structure

**Last Updated:** April 13, 2026

---

## 📁 Root Directory

```
studybuddy/
├── 📂 .agent/                    # Agent workflows
├── 📂 .github/                   # GitHub configuration
├── 📂 .kiro/                     # Kiro specs and configuration
│   └── specs/
│       └── security-hardening/   # Security hardening spec
├── 📂 docs/                      # 📚 All documentation (organized)
│   ├── security/                 # Security documentation
│   ├── troubleshooting/          # Troubleshooting guides
│   ├── fixes/                    # Historical fixes
│   ├── README.md                 # Documentation index
│   └── CLEANUP_SUMMARY.md        # Cleanup report
├── 📂 prisma/                    # Database schema and migrations
├── 📂 public/                    # Static assets
├── 📂 scripts/                   # Utility scripts
├── 📂 src/                       # Source code
│   ├── actions/                  # Server actions
│   ├── app/                      # Next.js app router
│   │   ├── api/                  # API routes
│   │   ├── dashboard/            # Dashboard pages
│   │   └── study/                # Study pages
│   ├── components/               # React components
│   ├── contexts/                 # React contexts
│   ├── hooks/                    # Custom hooks
│   ├── lib/                      # Utility libraries
│   │   ├── llm/                  # LLM integration
│   │   ├── __tests__/            # Unit tests
│   │   ├── admin.ts              # Admin authentication
│   │   ├── audit.ts              # Audit logging
│   │   ├── auth.ts               # User authentication
│   │   ├── cron-auth.ts          # Cron authentication
│   │   ├── csrf.ts               # CSRF protection
│   │   ├── db.ts                 # Database client
│   │   ├── featureLimits.ts      # Feature usage limits
│   │   ├── input-validator.ts    # Text input validation
│   │   ├── mime-validator.ts     # MIME type validation
│   │   ├── ratelimit.ts          # Rate limiting
│   │   ├── size-validator.ts     # File size validation
│   │   ├── startup-validator.ts  # Config validation
│   │   ├── usageVerifier.ts      # Usage verification
│   │   └── webhook-schemas.ts    # Webhook validation
│   └── types/                    # TypeScript types
├── 📄 .env.example               # Environment variables template
├── 📄 .gitignore                 # Git ignore rules
├── 📄 package.json               # Dependencies
├── 📄 README.md                  # Main project README
├── 📄 SECURITY_CHECKLIST.md      # ⭐ Pre-push security checklist
├── 📄 tsconfig.json              # TypeScript configuration
└── 📄 vercel.json                # Vercel deployment config
```

---

## 📚 Documentation Structure

```
docs/
├── 📂 security/                           # Security Documentation
│   ├── SECRETS_ROTATION.md                # Secret rotation guide
│   ├── SECURITY_FIX_VERIFICATION.md       # File size limit fix
│   ├── SECURITY_LAYERS_ANALYSIS.md        # Security layers analysis
│   ├── SECURITY_PRE_PUSH_VERIFICATION.md  # Pre-push verification report
│   └── USER_ERROR_HANDLING_ANALYSIS.md    # Error handling analysis
│
├── 📂 troubleshooting/                    # Troubleshooting Guides
│   ├── TROUBLESHOOTING_FAILED_TO_FETCH.md # Failed to fetch errors
│   └── test-rewrite-endpoint.md           # Rewrite endpoint testing
│
├── 📂 fixes/                              # Historical Fixes
│   ├── FIXES_APPLIED.md                   # Applied fixes log
│   ├── ROOT_CAUSE_AND_FIX.md              # Root cause analysis
│   └── STREAM_CONSUMPTION_FIX.md          # Stream consumption fix
│
├── 📄 README.md                           # Documentation index
├── 📄 CLEANUP_SUMMARY.md                  # Cleanup report
├── 📄 ONEDRIVE_FIX.md                     # OneDrive integration fix
└── 📄 PROJECT_STRUCTURE.md                # This file
```

---

## 🔒 Security Components

### Authentication & Authorization
```
src/lib/
├── admin.ts              # Admin guard (header-only auth)
├── auth.ts               # User authentication (Clerk)
└── cron-auth.ts          # Cron authentication (header-only)
```

### Input Validation
```
src/lib/
├── size-validator.ts     # File size validation (50MB docs, 100MB audio)
├── mime-validator.ts     # MIME type validation (magic numbers)
├── input-validator.ts    # Text input validation (100KB max)
└── webhook-schemas.ts    # Webhook payload validation (Zod)
```

### Rate Limiting & Usage
```
src/lib/
├── ratelimit.ts          # Redis rate limiting (30 req/60s)
├── featureLimits.ts      # Feature-based daily limits
└── usageVerifier.ts      # Usage verification (daily limits)
```

### Security Monitoring
```
src/lib/
├── audit.ts              # Audit logging
├── startup-validator.ts  # Config validation at startup
└── csrf.ts               # CSRF protection
```

---

## 🛡️ API Routes Security

### Public Routes (Rate Limited)
```
/api/generate                 # File upload → MIME + size validation
/api/generate-audio-notes     # Audio upload → MIME + size validation
/api/chat                     # Chat → Rate limit + daily limit
/api/flashcards               # Flashcards → Rate limit + daily limit
/api/quiz                     # Quiz → Rate limit + daily limit
/api/rewrite                  # Rewrite → Rate limit + text size validation
/api/feedback                 # Feedback → Rate limit (5 req/60s)
/api/bug-report               # Bug report → Rate limit (5 req/60s)
```

### Admin Routes (Require Admin Auth)
```
/api/llm/metrics              # LLM metrics → requireAdmin()
/api/llm/status               # LLM status → requireAdmin()
/api/health/billing           # Billing health → requireAdmin()
/api/debug-webhook-key        # Debug webhook → requireDebugSecret()
/api/fix-subscription         # Fix subscription → header auth
/api/test-email               # Test email → ADMIN_USER_IDS check
```

### Cron Routes (Require CRON_SECRET)
```
/api/cron/keep-alive                  # Keep alive → verifyCronAuth()
/api/cron/normalize-subscriptions     # Normalize → verifyCronAuth()
/api/cron/subscription-sync           # Sync → verifyCronAuth()
/api/cron/reminders                   # Reminders → verifyCronAuth()
/api/cron/subscription-reminders      # Sub reminders → verifyCronAuth()
```

### Webhook Routes (Signature Verification)
```
/api/webhooks/dodo-payments   # Dodo webhook → Zod validation
/api/webhooks/clerk           # Clerk webhook → Zod validation
```

---

## 🧪 Testing & Scripts

### Security Scripts
```
scripts/
├── scan-pii.ts                    # PII and API key scanner
├── scan-email-placeholders.ts     # Email placeholder scanner
└── validate-llm-config.ts         # LLM config validator
```

### Utility Scripts
```
scripts/
├── debug-clerk-sub.ts             # Debug Clerk subscription
├── debug-user-state.ts            # Debug user state
├── fix-subscription.ts            # Fix subscription issues
├── reset-subscriptions.ts         # Reset subscriptions
└── test-groq-connection.ts        # Test Groq API connection
```

### NPM Scripts
```bash
npm run test:security              # Run security scanners
npm run test:email-placeholders    # Scan email placeholders
npm run test:pii-scanner           # Scan for PII leaks
```

---

## 📦 Key Dependencies

### Core Framework
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety

### Database & ORM
- **Prisma** - Database ORM
- **PostgreSQL** - Production database (Neon)
- **SQLite** - Development database

### Authentication & Payments
- **Clerk** - User authentication
- **Dodo Payments** - Payment processing
- **Svix** - Webhook verification

### AI & LLM
- **Vercel AI SDK** - AI integration
- **Google Gemini** - Text generation
- **Groq** - Fast inference
- **Deepgram** - Audio transcription

### Security & Validation
- **Zod** - Schema validation
- **Upstash Redis** - Rate limiting
- **file-type** - MIME type detection

---

## 🚀 Development Workflow

### 1. Setup
```bash
npm install                    # Install dependencies
cp .env.example .env          # Create environment file
npx prisma db push            # Setup database
npx prisma generate           # Generate Prisma client
```

### 2. Development
```bash
npm run dev                   # Start dev server
npm run test:security         # Run security checks
```

### 3. Pre-Push Checklist
```bash
npm run test:security         # Security scanner
git check-ignore .env dev.db  # Verify gitignore
git diff --cached             # Review changes
```

### 4. Deployment
```bash
git push origin main          # Push to GitHub
# Vercel auto-deploys from main branch
```

---

## 📝 Important Files

### Must Read Before Contributing
1. **[README.md](../README.md)** - Project overview
2. **[SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md)** - Pre-push security checklist
3. **[docs/README.md](README.md)** - Documentation index

### Security Documentation
1. **[SECURITY_PRE_PUSH_VERIFICATION.md](security/SECURITY_PRE_PUSH_VERIFICATION.md)** - Latest security audit
2. **[SECURITY_LAYERS_ANALYSIS.md](security/SECURITY_LAYERS_ANALYSIS.md)** - Security architecture
3. **[SECRETS_ROTATION.md](security/SECRETS_ROTATION.md)** - Secret management

---

## 🎯 Quick Navigation

| Task | Location |
|------|----------|
| **Add new API route** | `src/app/api/` |
| **Add new component** | `src/components/` |
| **Add security validation** | `src/lib/` |
| **Add documentation** | `docs/` (categorized) |
| **Add utility script** | `scripts/` |
| **Update database schema** | `prisma/schema.prisma` |
| **Configure environment** | `.env` (use `.env.example` as template) |

---

**Last Updated:** April 13, 2026  
**Maintained By:** Development Team
