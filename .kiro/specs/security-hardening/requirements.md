# Requirements Document

## Introduction

This feature covers security hardening for the Skoowl Next.js application prior to pushing to GitHub. The application integrates Clerk authentication, Prisma ORM, Groq, Deepgram, Google Gemini, Dodo Payments, PayPal, Resend, and Upstash Redis. The hardening effort addresses three primary risk areas: secrets and API keys leaking to the client or to version control, sensitive files being committed to the repository, and insecure or unauthenticated API endpoints that could be exploited in production.

## Glossary

- **Repository**: The GitHub git repository for the Skoowl application.
- **Client Bundle**: JavaScript code delivered to the browser by Next.js.
- **Server-Only Secret**: An environment variable that must never appear in the Client Bundle (e.g., `CLERK_SECRET_KEY`, `GROQ_API_KEY`, `DATABASE_URL`).
- **NEXT_PUBLIC_ Variable**: A Next.js environment variable prefixed with `NEXT_PUBLIC_` that is intentionally embedded in the Client Bundle.
- **Debug Endpoint**: An API route intended only for development or admin diagnostics (e.g., `/api/debug-webhook-key`, `/api/test-rewrite-health`, `/api/fix-subscription`).
- **Sensitive File**: A file containing secrets, PII, or local database data that must not be committed (e.g., `.env`, `dev.db`, `prisma/dev.db`).
- **PII**: Personally Identifiable Information such as real email addresses or customer IDs.
- **Admin Guard**: The `requireAdmin()` + `requireDebugSecret()` middleware in `src/lib/admin.ts`.
- **CRON_SECRET**: The shared secret used to authenticate Vercel Cron job requests.
- **Gitignore**: The `.gitignore` file that controls which files git tracks.

---

## Requirements

### Requirement 1: Prevent Server-Only Secrets from Reaching the Client Bundle

**User Story:** As a developer, I want all server-only API keys and secrets to remain server-side only, so that credentials are never exposed to end users or scraped from the browser.

#### Acceptance Criteria

1. THE Repository SHALL contain no `NEXT_PUBLIC_` prefixed environment variable whose value is a secret key, private API key, or webhook signing secret.
2. WHEN the Next.js build runs, THE Client Bundle SHALL not include the values of `CLERK_SECRET_KEY`, `GROQ_API_KEY`, `DEEPGRAM_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `RESEND_API_KEY`, `DATABASE_URL`, `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `PAYPAL_CLIENT_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, or `CRON_SECRET`.
3. THE Repository SHALL contain a `src/lib/server-only-check.ts` module (or equivalent) that imports `server-only` so that any accidental import of secret-reading utilities in a Client Component causes a build-time error.
4. WHEN a developer adds a new environment variable that is a secret, THE `.env.example` file SHALL list the variable name with a placeholder value and no real secret.

---

### Requirement 2: Ensure Sensitive Files Are Not Committed to the Repository

**User Story:** As a developer, I want sensitive files excluded from version control, so that secrets, local databases, and PII are never pushed to GitHub.

#### Acceptance Criteria

1. THE Gitignore SHALL include patterns that prevent committing `dev.db`, `prisma/dev.db`, and any `*.db` file.
2. THE Gitignore SHALL include a pattern that prevents committing the `.tmp-llm-tests/` directory.
3. THE Gitignore SHALL include a pattern that prevents committing `public/uploads/` directory contents.
4. WHEN a developer runs `git status`, THE Repository SHALL show `dev.db` and `prisma/dev.db` as untracked or ignored (not staged or committed).
5. IF `dev.db` or `prisma/dev.db` are currently tracked by git, THEN THE Repository SHALL remove them from git tracking using `git rm --cached` without deleting the local files.
6. THE Repository SHALL contain a `.env.example` file listing all required environment variable names with placeholder values, so that new contributors know which variables to configure.
7. THE Gitignore SHALL include a pattern that prevents committing `kill_port.ps1` and other local developer utility scripts that are not part of the application.

---

### Requirement 3: Remove or Secure Debug and Development-Only API Endpoints

**User Story:** As a developer, I want debug and test API endpoints to be inaccessible in production, so that internal system state and configuration details cannot be queried by unauthorized parties.

#### Acceptance Criteria

1. WHEN a request is made to `/api/test-rewrite-health` in a production environment, THE System SHALL return HTTP 404 or HTTP 403 so the endpoint is not publicly accessible.
2. WHEN a request is made to `/api/debug-webhook-key` without valid admin credentials and a valid debug secret, THE System SHALL return HTTP 401 or HTTP 403.
3. WHEN a request is made to `/api/fix-subscription` without valid admin credentials and a valid `FIX_SUBSCRIPTION_SECRET` header, THE System SHALL return HTTP 401 or HTTP 403.
4. WHEN a request is made to `/api/health/billing` in a production environment, THE System SHALL require authentication before returning environment configuration details.
5. THE `src/app/api/test-email/route.ts` endpoint SHALL reject requests from non-admin users in production by returning HTTP 401.
6. WHILE `NODE_ENV` equals `production`, THE System SHALL not expose internal error messages or stack traces in API error responses.

---

### Requirement 4: Remove Hardcoded PII and Credentials from Scripts

**User Story:** As a developer, I want all scripts to use environment variables or command-line arguments instead of hardcoded values, so that real customer data and credentials are not stored in the codebase.

#### Acceptance Criteria

1. THE `scripts/fix-subscription.ts` file SHALL not contain hardcoded email addresses, subscription IDs, or customer IDs; instead THE Script SHALL read these values from environment variables or command-line arguments.
2. THE `scripts/debug-clerk-sub.ts` file SHALL not contain hardcoded email addresses; instead THE Script SHALL read the target email from an environment variable or command-line argument.
3. THE `scripts/debug-user-state.ts` file SHALL not contain hardcoded email addresses; instead THE Script SHALL read the target email from an environment variable or command-line argument.
4. WHEN a script requires a target email or ID and none is provided, THE Script SHALL print a usage message and exit with a non-zero exit code.

---

### Requirement 5: Secure Cron Job Endpoints Against Unauthorized Invocation

**User Story:** As a developer, I want all cron job API routes to consistently enforce authentication, so that they cannot be triggered by arbitrary external requests.

#### Acceptance Criteria

1. WHEN a request arrives at any `/api/cron/*` route without a valid `Authorization: Bearer <CRON_SECRET>` header, THE System SHALL return HTTP 401 regardless of `NODE_ENV`.
2. THE `src/app/api/cron/reminders/route.ts` endpoint SHALL enforce the `CRON_SECRET` check unconditionally (not only when `CRON_SECRET` is set), returning HTTP 401 if the secret is missing or does not match.
3. IF `CRON_SECRET` is not set in the environment, THEN THE System SHALL log a startup warning and all cron endpoints SHALL return HTTP 503 to prevent unauthenticated execution.

---

### Requirement 6: Establish a Pre-Push Security Checklist and Tooling

**User Story:** As a developer, I want automated and manual checks that run before pushing to GitHub, so that security regressions are caught before they reach the repository.

#### Acceptance Criteria

1. THE Repository SHALL contain a `SECURITY_CHECKLIST.md` file documenting the steps a developer must verify before pushing (secrets scan, gitignore check, debug endpoint review).
2. WHEN `npm run test:security` is executed, THE System SHALL scan source files for patterns matching real API key formats (e.g., `gsk_`, `sk_test_`, `re_`, `AIzaSy`) and exit with a non-zero code if any are found outside of `.env*` files.
3. THE Repository SHALL contain a `.env.example` file that is kept in sync with all variable names used in the application, with placeholder values only.
4. WHERE a `pre-push` git hook is configured, THE System SHALL run `npm run test:security` and block the push if the scan fails.

---

### Requirement 7: Secure Unauthenticated Monitoring Endpoints

**User Story:** As a security engineer, I want all monitoring and health check endpoints to require authentication, so that internal system state and operational metrics cannot be accessed by unauthorized parties.

#### Acceptance Criteria

1. WHEN a request is made to `/api/llm/metrics` without valid authentication credentials, THE System SHALL return HTTP 401 or HTTP 403.
2. WHEN a request is made to `/api/llm/status` without valid authentication credentials, THE System SHALL return HTTP 401 or HTTP 403.
3. WHEN a request is made to `/api/health/billing` without valid authentication credentials, THE System SHALL return HTTP 401 or HTTP 403.
4. THE `/api/llm/metrics` endpoint SHALL not expose LLM provider health status, rate limit details, request logs, token usage statistics, or routing configuration to unauthenticated users.
5. THE `/api/llm/status` endpoint SHALL not expose provider status, rate limit percentages, queue depth, degraded mode status, or content size routing metrics to unauthenticated users.
6. THE `/api/health/billing` endpoint SHALL not expose payment provider configuration, API key presence indicators, environment mode (test vs live), or billing feature flags to unauthenticated users.
7. WHEN authentication is required for monitoring endpoints, THE System SHALL use the Admin Guard (`requireAdmin()` + `requireDebugSecret()`) or equivalent authentication mechanism.

---

### Requirement 8: Fix Broken Cron Authentication Logic

**User Story:** As a security engineer, I want cron job endpoints to enforce authentication consistently across all environments, so that scheduled tasks cannot be triggered by unauthorized requests.

#### Acceptance Criteria

1. WHEN a request is made to `/api/cron/keep-alive` without a valid `Authorization: Bearer <CRON_SECRET>` header, THE System SHALL return HTTP 401 in both development and production environments.
2. WHEN a request is made to `/api/cron/keep-alive` with an invalid or mismatched `CRON_SECRET`, THE System SHALL return HTTP 401 regardless of `NODE_ENV` value.
3. THE `/api/cron/keep-alive` endpoint SHALL not bypass authentication checks in development mode when the secret does not match.
4. WHEN a request is made to `/api/cron/normalize-subscriptions` or `/api/cron/subscription-sync`, THE System SHALL reject authentication attempts using query parameters (e.g., `?secret=...`).
5. THE `/api/cron/normalize-subscriptions` and `/api/cron/subscription-sync` endpoints SHALL only accept `CRON_SECRET` via the `Authorization: Bearer` header, not via query parameters.
6. WHEN `CRON_SECRET` is not configured in the environment, THE System SHALL log a startup warning and all `/api/cron/*` endpoints SHALL return HTTP 503 with an error message indicating missing configuration.

---

### Requirement 9: Implement Server-Side MIME Type Validation for File Uploads

**User Story:** As a security engineer, I want all file uploads to be validated server-side for correct MIME types, so that malicious files with spoofed content types cannot be processed by the application.

#### Acceptance Criteria

1. WHEN a file is uploaded to `/api/generate`, THE System SHALL validate the file's MIME type using server-side magic number detection, not client-provided `file.type` values.
2. THE `/api/generate` endpoint SHALL reject files whose detected MIME type does not match the allowed types (PDF, DOCX, PPTX, TXT, audio formats).
3. WHEN a file upload fails MIME type validation, THE System SHALL return HTTP 400 with an error message indicating "Invalid file type detected".
4. THE System SHALL use a library such as `file-type` or `mmmagic` to perform magic number-based MIME type detection on uploaded file buffers.
5. WHEN a file's detected MIME type differs from the client-provided `file.type`, THE System SHALL log a security warning including the user ID, detected type, and claimed type.
6. THE System SHALL enforce maximum file size limits for all file uploads (e.g., 50MB for documents, 100MB for audio files) and return HTTP 413 when exceeded.

---

### Requirement 10: Remove Hardcoded Placeholder Admin IDs

**User Story:** As a security engineer, I want all admin authorization checks to use real environment-configured admin IDs, so that placeholder values do not create security vulnerabilities in production.

#### Acceptance Criteria

1. THE `/api/test-email/route.ts` file SHALL not contain hardcoded placeholder admin IDs such as `'user_2abc123'`.
2. WHEN the `/api/test-email` endpoint checks for admin authorization, THE System SHALL read admin user IDs from the `ADMIN_USER_IDS` environment variable.
3. IF `ADMIN_USER_IDS` is not configured in the environment, THEN THE `/api/test-email` endpoint SHALL only allow access in development mode (`NODE_ENV === 'development'`).
4. THE System SHALL parse `ADMIN_USER_IDS` as a comma-separated list of Clerk user IDs (e.g., `user_abc123,user_def456`).
5. WHEN a non-admin user attempts to access `/api/test-email` in production, THE System SHALL return HTTP 401 with an error message "Unauthorized".

---

### Requirement 11: Rotate Live Secrets After Repository Exposure

**User Story:** As a security engineer, I want all production API keys and secrets to be rotated immediately after securing the repository, so that any previously exposed credentials are invalidated.

#### Acceptance Criteria

1. THE Repository SHALL contain a `SECRETS_ROTATION.md` document listing all secrets that require rotation, their rotation priority (critical/high/medium), and rotation instructions.
2. THE `SECRETS_ROTATION.md` document SHALL include rotation instructions for Groq API keys, Google Gemini API keys, Deepgram API keys, Resend API keys, Dodo Payments API keys (test and live), PayPal credentials, Clerk webhook secrets, Upstash Redis tokens, and Neon database URLs.
3. WHEN a secret is rotated, THE Developer SHALL update the corresponding environment variable in all deployment environments (production, staging, development).
4. WHEN a secret is rotated, THE Developer SHALL verify that the old secret no longer grants access by testing with the old credential.
5. THE `SECRETS_ROTATION.md` document SHALL mark each secret as "Rotated" or "Pending" with a timestamp indicating when rotation was completed.
6. THE System SHALL log a warning at startup if any environment variable contains a value matching known exposed secrets (based on a configurable blocklist).

---

### Requirement 12: Enforce Input Validation and Size Limits on API Routes

**User Story:** As a security engineer, I want all API routes to enforce strict input validation and size limits, so that the application is protected against denial-of-service attacks and malformed payloads.

#### Acceptance Criteria

1. WHEN a file is uploaded to `/api/generate` or `/api/generate-audio-notes`, THE System SHALL enforce a maximum file size limit and return HTTP 413 (Payload Too Large) if exceeded.
2. THE System SHALL enforce a maximum file size of 50MB for document uploads (PDF, DOCX, PPTX, TXT) and 100MB for audio uploads.
3. WHEN a text input is submitted to any API route, THE System SHALL enforce a maximum content length (e.g., 100KB for text fields) and return HTTP 413 if exceeded.
4. WHEN a webhook payload is received at `/api/webhooks/dodo` or `/api/webhooks/clerk`, THE System SHALL validate the payload schema using Zod or equivalent validation library before processing.
5. IF webhook payload validation fails, THEN THE System SHALL return HTTP 400 with an error message indicating which fields failed validation.
6. THE System SHALL enforce rate limiting on all public API routes to prevent abuse (e.g., 100 requests per minute per IP address).
7. WHEN rate limiting is triggered, THE System SHALL return HTTP 429 (Too Many Requests) with a `Retry-After` header indicating when the client can retry.
