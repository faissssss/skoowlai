# Implementation Plan: Security Hardening

## Overview

This implementation plan focuses on **critical security vulnerabilities** that pose real threats to production. Tasks are prioritized by impact and urgency, with overkill items removed for a lean, practical approach.

## Priority Levels

- **🔴 CRITICAL**: Real vulnerabilities that must be fixed before deployment
- **🟠 HIGH**: Important security improvements with moderate risk
- **🟡 MEDIUM**: Nice-to-have hardening for defense-in-depth
- **⚪ REMOVED**: Overkill for current scale (commented out)

## Tasks

<!-- REMOVED: Task 1 - server-only wrapping is overkill for this scale. Next.js already enforces this at build time. -->
<!-- REMOVED: Task 1.1 - No need for tests on removed functionality -->

- [ ] 🔴 **CRITICAL** 1. Implement MIME type validation system (Real threat: malicious file uploads)
  - [x] 2.1 Create MIME validator module with magic number detection
    - Install `file-type` npm package
    - Create `src/lib/mime-validator.ts` with `MimeValidationResult` interface
    - Implement `validateMimeType()` function using file-type library
    - Define allowed MIME types for documents and audio files
    - _Requirements: 9.1, 9.2, 9.4_

  <!-- REMOVED: Property tests 2.2-2.4 - Overkill. Basic integration test is sufficient. -->

- [ ] 🔴 **CRITICAL** 2. Implement file size validation (Essential for DoS protection)
  - [x] 3.1 Create file size validator utility
    - Create `src/lib/size-validator.ts` with size limit constants
    - Implement `validateFileSize()` function with type-specific limits (50MB documents, 100MB audio)
    - _Requirements: 9.6, 12.1, 12.2_

  <!-- REMOVED: Property test 3.2 - Basic test is enough -->

  - [x] 3.3 Integrate MIME and size validation into /api/generate endpoint
    - Update `src/app/api/generate/route.ts` to use `validateFileSize()` first
    - Add `validateMimeType()` call after size check
    - Return HTTP 400 for invalid MIME types with generic error message
    - Log MIME type mismatches with security warning
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_

  - [x] 3.4 Integrate MIME and size validation into /api/generate-audio-notes endpoint
    - Update `src/app/api/generate-audio-notes/route.ts` with same validation pattern
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 12.1_

- [ ] 🟡 **CHECKPOINT** 3. Test file upload validation manually
  - Upload a file >50MB (should reject with 413)
  - Upload a .exe file renamed to .pdf (should reject with 400)

- [ ] 🔴 **CRITICAL** 4. Fix admin guard - remove query param auth (Real vulnerability: secrets in logs)
  - [x] 5.1 Update admin guard with fail-secure authentication
    - Update `src/lib/admin.ts` `requireDebugSecret()` function
    - Remove query parameter authentication support
    - Add header-only authentication (`x-debug-secret` header)
    - Return HTTP 404 when secret not configured (fail secure)
    - Add audit logging for authentication failures
    - _Requirements: 3.2, 3.3, 3.6_

  <!-- REMOVED: Property test 5.2 - Manual testing is sufficient -->

  - [x] 5.3 Apply admin guard to debug endpoints
    - Update `/api/debug-webhook-key/route.ts` to use enhanced admin guard
    - Update `/api/fix-subscription/route.ts` to require `FIX_SUBSCRIPTION_SECRET` header
    - Update `/api/test-email/route.ts` to use `ADMIN_USER_IDS` environment variable
    - Remove hardcoded placeholder admin IDs from `/api/test-email/route.ts`
    - _Requirements: 3.2, 3.3, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 5.4 Secure monitoring endpoints with admin guard
    - Update `/api/llm/metrics/route.ts` to require admin authentication
    - Update `/api/llm/status/route.ts` to require admin authentication
    - Update `/api/health/billing/route.ts` to require admin authentication
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.5 Secure or remove test-rewrite-health endpoint
    - Update `/api/test-rewrite-health/route.ts` to return HTTP 404 in production
    - Add environment check: only accessible when `NODE_ENV === 'development'`
    - _Requirements: 3.1_

- [ ] 🔴 **CRITICAL** 5. Fix cron authentication (Currently bypassable in prod)
  - [x] 6.1 Create centralized cron authentication module
    - Create `src/lib/cron-auth.ts` with `CronAuthResult` interface
    - Implement `verifyCronAuth()` function with header-only authentication
    - Return HTTP 503 when `CRON_SECRET` not configured (fail secure)
    - Add audit logging for failed authentication attempts
    - _Requirements: 5.1, 5.2, 5.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  <!-- REMOVED: Property tests 6.2-6.3 - Manual testing is sufficient -->

  - [x] 6.4 Apply cron authentication to all cron endpoints
    - Update `/api/cron/keep-alive/route.ts` to use `verifyCronAuth()`
    - Update `/api/cron/normalize-subscriptions/route.ts` to use `verifyCronAuth()`
    - Update `/api/cron/subscription-sync/route.ts` to use `verifyCronAuth()`
    - Update `/api/cron/reminders/route.ts` to use `verifyCronAuth()`
    - Update `/api/cron/subscription-reminders/route.ts` to use `verifyCronAuth()`
    - Remove query parameter authentication from all cron endpoints
    - _Requirements: 5.1, 5.2, 8.1, 8.2, 8.4, 8.5_

- [ ] 🟡 **CHECKPOINT** 6. Test authentication manually
  - Try accessing `/api/cron/keep-alive` without auth (should return 401)
  - Try accessing `/api/llm/metrics` without auth (should return 401)

- [x] 🟠 **HIGH** 7. Add webhook payload validation (Prevents malformed webhook exploits)
  - [x] 8.1 Create Zod schemas for webhook payloads
    - Create `src/lib/webhook-schemas.ts` with Zod schemas
    - Define schema for Dodo Payments webhook payload
    - Define schema for Clerk webhook payload
    - _Requirements: 12.4, 12.5_

  - [x] 8.2 Integrate schema validation into webhook endpoints
    - Update `/api/webhooks/dodo/route.ts` to validate payload with Zod
    - Update `/api/webhooks/clerk/route.ts` to validate payload with Zod
    - Return HTTP 400 with field-specific error messages on validation failure
    - _Requirements: 12.4, 12.5_

  <!-- REMOVED: Property test 8.3 - Basic test is enough -->

- [x] 🟠 **HIGH** 8. Add rate limiting (Protects against API abuse and cost overruns)
  - [x] 9.1 Create rate limiter utility using Upstash Redis
    - Create `src/lib/rate-limiter.ts` with rate limit configuration
    - Implement `checkRateLimit()` function using Upstash Redis
    - Configure 100 requests per minute per IP address limit
    - _Requirements: 12.6, 12.7_

  <!-- REMOVED: Property test 9.2 - Basic test is enough -->

  - [x] 9.3 Apply rate limiting to public API routes
    - Add rate limiting to `/api/generate/route.ts`
    - Add rate limiting to `/api/generate-audio-notes/route.ts`
    - Add rate limiting to `/api/chat/route.ts`
    - Add rate limiting to `/api/flashcards/route.ts`
    - Return HTTP 429 with Retry-After header when limit exceeded
    - _Requirements: 12.6, 12.7_

- [x] 🟡 **MEDIUM** 9. Add text input size limits (100KB max)
  - [x] 10.1 Add text content size validation to API routes
    - Create `src/lib/input-validator.ts` with max content length constants
    - Implement `validateTextInput()` function with 100KB limit
    - Apply to all API routes accepting text input
    - Return HTTP 413 when text content exceeds limit
    - _Requirements: 12.3_

  <!-- REMOVED: Property test 10.2 - Not critical -->

<!-- REMOVED: Checkpoint 11 - Redundant -->

- [ ] 🔴 **CRITICAL** 10. Set up security scanner + pre-push hook (Prevents secret leaks)
  - [x] 12.1 Enhance existing PII scanner scripts
    - Update `scripts/scan-pii.ts` to scan for API key patterns
    - Add patterns: `gsk_`, `sk_test_`, `sk_live_`, `re_`, `AIzaSy`, `whsec_`
    - Exclude `.env*` files from scans
    - Exit with non-zero code if violations found
    - Generate detailed report with file locations and line numbers
    - _Requirements: 6.2_

  <!-- REMOVED: Property test 12.2 - Scanner already has tests -->

  - [x] 12.3 Create npm script for security testing
    - Add `test:security` script to `package.json`
    - Script runs `scan-pii.ts` and `scan-email-placeholders.ts`
    - _Requirements: 6.2_

  - [x] 12.4 Create security checklist documentation
    - Create `SECURITY_CHECKLIST.md` with pre-push verification steps
    - Document secrets scan, gitignore check, debug endpoint review
    - _Requirements: 6.1_

  - [~] 12.5 Set up git pre-push hook (optional)
    - Create `.husky/pre-push` hook that runs `npm run test:security`
    - Hook blocks push if security scan fails
    - _Requirements: 6.4_

- [ ] 🔴 **CRITICAL** 11. Update .gitignore and untrack sensitive files (Prevents committing secrets/DBs)
  - [x] 13.1 Update .gitignore with security patterns
    - Add patterns for `*.db`, `dev.db`, `prisma/dev.db`
    - Add pattern for `.tmp-llm-tests/` directory
    - Add pattern for `public/uploads/` directory contents
    - Add pattern for `kill_port.ps1` and local utility scripts
    - _Requirements: 2.1, 2.2, 2.3, 2.7_

  - [x] 13.2 Remove tracked sensitive files from git history
    - Run `git rm --cached dev.db prisma/dev.db` to untrack database files
    - Verify files remain on local filesystem
    - _Requirements: 2.4, 2.5_

  - [x] 13.3 Create or update .env.example file
    - List all required environment variable names
    - Use placeholder values only (no real secrets)
    - Document which variables are server-only vs NEXT_PUBLIC_
    - _Requirements: 1.4, 2.6_

- [ ] 🔴 **CRITICAL** 12. Remove hardcoded PII from scripts (Real customer data exposed)
  - [x] 14.1 Update scripts to use environment variables
    - Update `scripts/fix-subscription.ts` to read email/IDs from env vars or CLI args
    - Update `scripts/debug-clerk-sub.ts` to read email from env var or CLI arg
    - Update `scripts/debug-user-state.ts` to read email from env var or CLI arg
    - Add usage messages when required arguments are missing
    - Exit with non-zero code when arguments missing
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 🟡 **MEDIUM** 13. Add startup config validation (Nice-to-have warnings)
  - [x] 15.1 Add configuration checks to startup validator
    - Check that all required secrets are present (CRON_SECRET, CLERK_SECRET_KEY, etc.)
    - Check that no NEXT_PUBLIC_ variables contain secret patterns
    - Check that ADMIN_USER_IDS is configured (not placeholder values)
    - Check that DATABASE_URL is not using default/example values
    - Log warnings for missing or suspicious configuration
    - _Requirements: 5.3, 8.6, 10.3, 11.6_

  <!-- REMOVED: Property test 15.2 - Not critical -->

- [ ] 🔴 **CRITICAL** 14. Create SECRETS_ROTATION.md and rotate all keys (Exposed secrets must be invalidated)
  - [x] 16.1 Create SECRETS_ROTATION.md document
    - List all secrets requiring rotation with priority levels
    - Include rotation instructions for each service (Groq, Gemini, Deepgram, Resend, Dodo, PayPal, Clerk, Upstash, Neon)
    - Add checklist for marking secrets as "Rotated" or "Pending" with timestamps
    - Document verification steps for confirming old secrets are invalidated
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 🟠 **HIGH** 15. Final integration testing
  - [x] 17.1 Wire all security components together
    - Verify startup validator runs on application start
    - Verify all endpoints use appropriate authentication middleware
    - Verify all file uploads use MIME and size validation
    - Verify all webhooks use schema validation
    - Verify rate limiting is active on public routes
    - _Requirements: All_

  <!-- REMOVED: Integration tests 17.2 - Manual testing is sufficient for now -->

- [x] 🟡 **CHECKPOINT** 16. Final security audit
  - Run `npm run test:security` and verify zero violations
  - Verify `.env` is in `.gitignore` and not tracked
  - Verify `dev.db` and `prisma/dev.db` are not tracked by git
  - Review all NEXT_PUBLIC_ variables (confirm none are secrets)
  - Verify admin user IDs are real (not placeholders)
  - Test all cron endpoints with invalid secret (should return 401)
  - Test all debug endpoints without admin auth (should return 403)
  - Test monitoring endpoints require authentication
  - Test file upload with invalid MIME type (should return 400)
  - Ensure all tests pass, ask the user if questions arise.

## Execution Order (Recommended)

**Phase 1: Stop the bleeding (Critical vulnerabilities)**
1. Task 11 - .gitignore + untrack sensitive files
2. Task 12 - Remove hardcoded PII from scripts
3. Task 10 - Security scanner + pre-push hook
4. Task 14 - Rotate all exposed secrets

**Phase 2: Core security (Real threats)**
5. Task 1 - MIME type validation
6. Task 2 - File size limits
7. Task 4 - Fix admin guard (remove query params)
8. Task 5 - Fix cron authentication

**Phase 3: Defense in depth (Important but not urgent)**
9. Task 7 - Webhook validation
10. Task 8 - Rate limiting
11. Task 9 - Text input limits
12. Task 13 - Startup config validation

**Phase 4: Verification**
13. Task 3, 6, 16 - Checkpoints and final audit

## Notes

- **Removed overkill items**: server-only wrapper, property-based tests (12 removed), excessive integration tests
- **Focus on real threats**: File uploads, authentication bypasses, secret exposure, PII leaks
- **Practical approach**: Manual testing instead of exhaustive property tests
- **Fail-secure principle**: All auth checks deny by default
- **MIME validation**: Uses magic number detection (file-type library)
- **Rate limiting**: Uses existing Upstash Redis infrastructure
