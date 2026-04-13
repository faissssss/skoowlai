# Security Hardening Design Document

## Overview

This design document outlines the security hardening implementation for the Skoowl Next.js application. The feature addresses critical security vulnerabilities across three primary risk areas:

1. **Secrets Management**: Preventing API keys and credentials from leaking to the client bundle or version control
2. **Access Control**: Securing debug endpoints, monitoring APIs, and cron jobs against unauthorized access
3. **Input Validation**: Implementing robust server-side validation for file uploads and API payloads

The implementation follows a defense-in-depth approach with multiple layers of security controls:
- **Prevention**: Blocking secrets at build time and in version control
- **Detection**: Automated scanning for exposed credentials and PII
- **Enforcement**: Consistent authentication across all sensitive endpoints
- **Validation**: Server-side MIME type detection and input sanitization

### Key Design Principles

1. **Fail Secure**: All authentication checks default to deny access
2. **Defense in Depth**: Multiple overlapping security controls
3. **Least Privilege**: Endpoints require minimum necessary permissions
4. **Auditability**: Security events are logged for forensic analysis
5. **Separation of Concerns**: Security logic is centralized and reusable

## Architecture

### Component Overview

```mermaid
graph TB
    subgraph "Build Time Security"
        A[server-only Package] --> B[Build Validation]
        C[Secret Scanner] --> B
        D[.gitignore Rules] --> E[Git Hooks]
    end
    
    subgraph "Runtime Security"
        F[Admin Guard Middleware] --> G[Debug Endpoints]
        H[Cron Auth Middleware] --> I[Cron Endpoints]
        J[MIME Validator] --> K[File Upload Endpoints]
        L[Rate Limiter] --> M[Public APIs]
    end
    
    subgraph "Monitoring"
        N[Audit Logger] --> O[Security Events]
        P[Startup Validator] --> Q[Config Warnings]
    end
    
    B --> Runtime Security
    E --> Runtime Security
    Runtime Security --> Monitoring
```

### Security Layers

#### Layer 1: Build-Time Prevention
- **server-only** package prevents client-side imports of secret-reading modules
- TypeScript compilation fails if server-only code is imported in Client Components
- Next.js build process validates environment variable prefixes

#### Layer 2: Version Control Protection
- `.gitignore` patterns block sensitive files (databases, uploads, temp files)
- Git pre-push hooks run security scanners before code reaches remote
- `.env.example` provides safe template without real secrets

#### Layer 3: Runtime Authentication
- **Admin Guard**: Combines Clerk user authentication + debug secret validation
- **Cron Guard**: Validates `Authorization: Bearer <CRON_SECRET>` header
- **Rate Limiting**: Upstash Redis-based rate limiting per IP/user

#### Layer 4: Input Validation
- **MIME Type Detection**: Magic number-based file type validation (not client-provided headers)
- **Size Limits**: Enforced maximum file sizes (50MB documents, 100MB audio)
- **Schema Validation**: Zod schemas for webhook payloads and API requests

#### Layer 5: Monitoring & Audit
- Security events logged to audit trail (authentication failures, suspicious uploads)
- Startup validation warns about missing or exposed secrets
- Health check endpoints report configuration status (admin-only)

## Components and Interfaces

### 1. Server-Only Module Guard

**Purpose**: Prevent accidental import of secret-reading utilities in Client Components

**Location**: `src/lib/server-only-check.ts`

**Interface**:
```typescript
// This module imports 'server-only' to trigger build errors
// if imported in Client Components
import 'server-only';

export function getServerSecret(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required secret: ${key}`);
  }
  return value;
}
```

**Usage**:
```typescript
// ✅ Safe: Server Component or API Route
import { getServerSecret } from '@/lib/server-only-check';
const apiKey = getServerSecret('GROQ_API_KEY');

// ❌ Build Error: Client Component
'use client';
import { getServerSecret } from '@/lib/server-only-check';
// Error: Cannot import server-only module in Client Component
```

### 2. Enhanced Admin Guard

**Purpose**: Centralized authentication for debug and admin endpoints

**Location**: `src/lib/admin.ts` (enhanced)

**Interface**:
```typescript
export interface AdminAuthResult {
  ok: boolean;
  userId?: string;
  response?: NextResponse;
}

export async function requireAdmin(): Promise<AdminAuthResult>;
export function requireDebugSecret(
  req: Request, 
  envVarName: string
): NextResponse | null;
```

**Current Implementation Issues**:
- `requireDebugSecret` accepts secrets via query parameters (insecure)
- No logging of authentication failures
- Missing environment variable validation at startup

**Enhanced Implementation**:
```typescript
export function requireDebugSecret(
  req: Request,
  envVarName: string
): NextResponse | null {
  const expected = process.env[envVarName];
  
  // Fail secure: missing secret = deny access
  if (!expected) {
    console.warn(`[Security] ${envVarName} not configured`);
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  // Only accept header-based authentication (not query params)
  const provided = req.headers.get('x-debug-secret');
  
  if (provided !== expected) {
    // Log authentication failure for audit
    console.warn(`[Security] Failed debug auth attempt for ${envVarName}`);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null; // Success
}
```

### 3. Cron Authentication Middleware

**Purpose**: Consistent authentication for all cron job endpoints

**Location**: `src/lib/cron-auth.ts` (new)

**Interface**:
```typescript
export interface CronAuthResult {
  authorized: boolean;
  response?: NextResponse;
}

export function verifyCronAuth(req: Request): CronAuthResult;
```

**Implementation**:
```typescript
export function verifyCronAuth(req: Request): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET;
  
  // Fail secure: missing secret = deny all cron access
  if (!cronSecret) {
    console.error('[Security] CRON_SECRET not configured');
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Service unavailable' },
        { status: 503 }
      )
    };
  }

  const authHeader = req.headers.get('authorization');
  const expectedHeader = `Bearer ${cronSecret}`;

  if (authHeader !== expectedHeader) {
    console.warn('[Security] Failed cron auth attempt');
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    };
  }

  return { authorized: true };
}
```

**Usage Pattern**:
```typescript
// In any /api/cron/* route
export async function GET(req: Request) {
  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response;
  
  // Proceed with cron logic...
}
```

### 4. MIME Type Validator

**Purpose**: Server-side file type validation using magic numbers

**Location**: `src/lib/mime-validator.ts` (new)

**Interface**:
```typescript
export interface MimeValidationResult {
  valid: boolean;
  detectedType: string | null;
  error?: string;
}

export async function validateMimeType(
  buffer: Buffer,
  allowedTypes: string[]
): Promise<MimeValidationResult>;
```

**Implementation Strategy**:
- Use `file-type` npm package for magic number detection
- Compare detected MIME type against allowlist
- Log mismatches between client-provided and detected types
- Return detailed error messages for debugging

**Supported File Types**:
- Documents: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `text/plain`
- Audio: `audio/webm`, `audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/ogg`

### 5. Security Scanner Scripts

**Purpose**: Automated detection of exposed secrets and PII

**Location**: `scripts/scan-pii.ts`, `scripts/scan-email-placeholders.ts`

**Current Implementation**: Already exists with basic pattern matching

**Enhancement Requirements**:
- Scan for API key patterns: `gsk_`, `sk_test_`, `sk_live_`, `re_`, `AIzaSy`, `whsec_`
- Exclude `.env*` files from scans
- Exit with non-zero code if secrets found
- Generate detailed report with file locations

**Interface**:
```typescript
export interface ScanResult {
  filesScanned: number;
  violationsFound: number;
  violations: Array<{
    file: string;
    line: number;
    pattern: string;
    context: string;
  }>;
}

export async function scanForSecrets(): Promise<ScanResult>;
```

### 6. Startup Configuration Validator

**Purpose**: Validate security-critical environment variables at application startup

**Location**: `src/lib/startup-validator.ts` (new)

**Interface**:
```typescript
export interface StartupValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateSecurityConfig(): StartupValidation;
```

**Validation Checks**:
- All required secrets are present (CRON_SECRET, CLERK_SECRET_KEY, etc.)
- No NEXT_PUBLIC_ variables contain secret patterns
- Admin user IDs are configured (not placeholder values)
- Database URL is not using default/example values

### 7. Audit Logger

**Purpose**: Centralized security event logging

**Location**: `src/lib/audit.ts` (enhanced)

**Interface**:
```typescript
export interface AuditEvent {
  userId: string;
  action: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  timestamp?: Date;
}

export async function logAudit(event: AuditEvent): Promise<void>;
```

**Logged Events**:
- Authentication failures (admin, cron, debug endpoints)
- MIME type validation failures
- Rate limit violations
- Suspicious file uploads (type mismatch)
- Secret rotation events

## Data Models

### Environment Variables Schema

```typescript
// Required Server-Only Secrets
interface ServerSecrets {
  // Authentication
  CLERK_SECRET_KEY: string;
  CRON_SECRET: string;
  DEBUG_ENDPOINTS_SECRET: string;
  FIX_SUBSCRIPTION_SECRET: string;
  
  // LLM Providers
  GROQ_API_KEY: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  DEEPGRAM_API_KEY: string;
  SUPADATA_API_KEY: string;
  
  // Payment Providers
  DODO_PAYMENTS_API_KEY: string;
  DODO_PAYMENTS_WEBHOOK_KEY: string;
  PAYPAL_CLIENT_SECRET: string;
  
  // Infrastructure
  DATABASE_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  RESEND_API_KEY: string;
  
  // Admin Configuration
  ADMIN_USER_IDS: string; // Comma-separated list
}

// Safe Client-Exposed Variables
interface ClientConfig {
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_VERCEL_URL: string;
  
  // Product IDs (safe to expose)
  NEXT_PUBLIC_DODO_MONTHLY_PRODUCT_ID: string;
  NEXT_PUBLIC_DODO_YEARLY_PRODUCT_ID: string;
  NEXT_PUBLIC_DODO_MONTHLY_NO_TRIAL_PRODUCT_ID: string;
  NEXT_PUBLIC_DODO_YEARLY_NO_TRIAL_PRODUCT_ID: string;
  NEXT_PUBLIC_DODO_STUDENT_MONTHLY_PRODUCT_ID: string;
  NEXT_PUBLIC_DODO_STUDENT_YEARLY_PRODUCT_ID: string;
}
```

### Audit Log Schema

```typescript
interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}
```

### File Upload Validation Schema

```typescript
interface FileUploadValidation {
  fileHash: string; // SHA-256 hash for deduplication
  originalName: string;
  clientProvidedType: string;
  detectedType: string;
  fileSize: number;
  userId: string;
  uploadedAt: Date;
  validationPassed: boolean;
  validationErrors?: string[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties and eliminated redundancy:

**Consolidated Authentication Properties**: Multiple criteria (3.2, 3.3, 5.1, 5.2, 7.1, 7.2, 7.3, 8.1, 8.2, 10.5) all test that invalid credentials are rejected. These are combined into Property 1 (Authentication Rejection Universality).

**Consolidated Cron Properties**: Criteria 5.1, 5.2, 5.3, 8.1, 8.2, 8.3, 8.5, 8.6 all relate to cron authentication. Combined into Properties 2 (Cron Authentication Consistency) and 3 (Cron Configuration Validation).

**Consolidated File Size Properties**: Criteria 9.6, 12.1, 12.2 all test file size limits. Combined into Property 4 (File Size Limit Enforcement).

**Consolidated MIME Properties**: Criteria 9.1, 9.2, 9.5 all relate to MIME type validation. Combined into Properties 5 (MIME Detection Consistency) and 6 (MIME Type Rejection).

**Consolidated Error Response Properties**: Criteria 9.3, 12.5, 12.7 test error response formats. Combined into Property 9 (Error Response Consistency).

### Property 1: Authentication Rejection Universality

*For any* authenticated endpoint (debug, admin, monitoring, or cron), when a request is made with invalid credentials (missing, malformed, or incorrect), the system SHALL return HTTP 401 or HTTP 403 without exposing the reason for rejection.

**Validates: Requirements 3.2, 3.3, 5.1, 5.2, 7.1, 7.2, 7.3, 8.1, 8.2, 10.5**

**Rationale**: Authentication checks must be consistent across all endpoints. Invalid credentials should always be rejected with generic error messages to prevent information leakage about valid credentials or authentication mechanisms.

### Property 2: Cron Authentication Environment Consistency

*For any* cron endpoint request, if the Authorization header does not match `Bearer <CRON_SECRET>`, the system SHALL return HTTP 401 regardless of NODE_ENV value (development, production, test) or request method.

**Validates: Requirements 5.1, 5.2, 8.1, 8.2, 8.3**

**Rationale**: Cron authentication must not be bypassed in development mode. Security checks must be consistent across all environments to prevent configuration-dependent vulnerabilities.

### Property 3: Cron Authentication Method Restriction

*For any* cron endpoint request, authentication SHALL only succeed when CRON_SECRET is provided via the Authorization header; query parameter authentication SHALL be rejected even if the secret value is correct.

**Validates: Requirements 8.4, 8.5**

**Rationale**: Query parameters are logged in web server access logs and browser history, making them unsuitable for secrets. Only header-based authentication should be accepted.

### Property 4: File Size Limit Enforcement

*For any* file upload request, if the file size exceeds the configured maximum limit for its type (50MB for documents, 100MB for audio), the system SHALL reject the upload with HTTP 413 before processing the file content.

**Validates: Requirements 9.6, 12.1, 12.2**

**Rationale**: Size limits must be enforced at the earliest possible point to prevent resource exhaustion attacks. Validation must happen before expensive operations like MIME detection or content processing.

### Property 5: MIME Type Detection Consistency

*For any* file buffer, detecting the MIME type using magic number analysis SHALL produce the same result on repeated invocations, and SHALL be independent of client-provided Content-Type headers or file extensions.

**Validates: Requirements 9.1**

**Rationale**: MIME type detection is a pure function based on file content. Given the same input, it must always produce the same output. Client-provided metadata cannot be trusted and must not influence detection.

### Property 6: MIME Type Rejection Completeness

*For any* file upload to an endpoint with MIME type restrictions, if the detected MIME type (via magic number analysis) is not in the allowed list, the system SHALL reject the upload with HTTP 400 regardless of the client-provided Content-Type header.

**Validates: Requirements 9.2**

**Rationale**: MIME type validation must use server-side detection, not client-provided headers. All files with disallowed types must be rejected to prevent malicious file uploads.

### Property 7: MIME Type Mismatch Logging

*For any* file upload where the detected MIME type differs from the client-provided Content-Type header, the system SHALL log a security warning containing the user ID, detected type, claimed type, and filename.

**Validates: Requirements 9.5**

**Rationale**: MIME type mismatches may indicate malicious intent (e.g., executable disguised as image). All mismatches should be logged for security monitoring and forensic analysis.

### Property 8: Secret Pattern Detection Completeness

*For any* source file containing a string matching known API key patterns (gsk_, sk_test_, sk_live_, re_, AIzaSy, whsec_), the security scanner SHALL detect and report the violation unless the file is in the exclusion list (.env*, node_modules).

**Validates: Requirements 6.2**

**Rationale**: The security scanner must reliably detect all secret patterns to prevent accidental commits. False negatives could lead to credential exposure in version control.

### Property 9: Error Response Consistency

*For any* validation failure (MIME type rejection, size limit exceeded, schema validation failure), the system SHALL return the appropriate HTTP error code (400 for invalid input, 413 for size exceeded) with a generic error message, while logging detailed information server-side.

**Validates: Requirements 9.3, 12.5**

**Rationale**: Error responses must be consistent and must not expose internal implementation details to clients. Detailed error information should only be available in server logs for debugging.

### Property 10: Rate Limit Response Format

*For any* API request that exceeds the configured rate limit, the system SHALL return HTTP 429 with a Retry-After header indicating when the client can retry, and SHALL not process the request.

**Validates: Requirements 12.7**

**Rationale**: Rate limiting must provide clear feedback to clients about when they can retry. The Retry-After header enables clients to implement proper backoff strategies.

### Property 11: Configuration Validation Consistency

*For any* security-critical endpoint (cron, debug, admin), if the required environment variable (CRON_SECRET, DEBUG_ENDPOINTS_SECRET, ADMIN_USER_IDS) is not configured, the system SHALL return HTTP 503 and log a warning at startup.

**Validates: Requirements 5.3, 8.6**

**Rationale**: Missing security configuration should fail secure by denying all access. Endpoints should not fall back to insecure defaults or bypass authentication when configuration is missing.

### Property 12: Webhook Schema Validation Completeness

*For any* webhook payload that does not conform to the expected Zod schema, the system SHALL reject the request with HTTP 400 and include details about which fields failed validation.

**Validates: Requirements 12.4, 12.5**

**Rationale**: Webhook payloads must be validated before processing to prevent injection attacks and data corruption. Validation errors should provide actionable feedback for debugging.

## Error Handling

### Error Handling Strategy

The security hardening implementation follows a **fail-secure** error handling approach:

1. **Missing Configuration**: If a required secret is not configured, deny access (don't fall back to insecure defaults)
2. **Validation Failures**: Log detailed errors server-side, return generic messages to clients
3. **Authentication Errors**: Always return 401/403, never expose why authentication failed
4. **File Upload Errors**: Reject invalid files immediately, log suspicious patterns

### Error Response Patterns

#### Authentication Failures
```typescript
// ❌ Bad: Reveals why authentication failed
return NextResponse.json(
  { error: 'Invalid CRON_SECRET' },
  { status: 401 }
);

// ✅ Good: Generic error message
return NextResponse.json(
  { error: 'Unauthorized' },
  { status: 401 }
);
```

#### Configuration Errors
```typescript
// Missing secret at startup
if (!process.env.CRON_SECRET) {
  console.error('[Security] CRON_SECRET not configured - cron endpoints disabled');
}

// Missing secret at runtime
if (!cronSecret) {
  return NextResponse.json(
    { error: 'Service unavailable' },
    { status: 503 }
  );
}
```

#### Validation Errors
```typescript
// Client receives generic error
return NextResponse.json(
  { error: 'Invalid file type detected' },
  { status: 400 }
);

// Server logs detailed information
console.warn('[Security] MIME type mismatch', {
  userId,
  clientType: file.type,
  detectedType: result.detectedType,
  fileName: file.name
});
```

### Error Recovery

1. **Transient Failures**: Rate limiting, temporary service unavailability
   - Return HTTP 429/503 with Retry-After header
   - Client should implement exponential backoff

2. **Configuration Errors**: Missing environment variables
   - Log error at startup
   - Disable affected endpoints (return 503)
   - Require manual intervention to fix

3. **Validation Failures**: Invalid input, malicious files
   - Reject immediately with 400/413
   - Log for security audit
   - No automatic retry (client must fix input)

4. **Authentication Failures**: Invalid credentials
   - Return 401/403 immediately
   - Log for security monitoring
   - No automatic retry (user must re-authenticate)

### Logging Levels

- **INFO**: Successful operations (file uploaded, cron job completed)
- **WARN**: Suspicious but not critical (MIME type mismatch, rate limit approaching)
- **ERROR**: Failed operations (authentication failure, validation error)
- **CRITICAL**: Security incidents (secret exposure detected, repeated auth failures)

## Testing Strategy

### Testing Approach

This security hardening feature requires a **dual testing approach**:

1. **Property-Based Tests**: For pure validation logic (MIME detection, pattern matching, size checks)
2. **Integration Tests**: For authentication flows, endpoint security, and configuration validation
3. **Manual Security Audit**: For secrets rotation, gitignore effectiveness, and deployment verification

### Property-Based Testing

**Library**: `fast-check` (already in dependencies)

**Configuration**: Minimum 100 iterations per property test

**Test Organization**:
```
src/lib/__tests__/
  ├── mime-validator.property.test.ts
  ├── secret-scanner.property.test.ts
  ├── size-validator.property.test.ts
  └── auth-middleware.property.test.ts
```

**Property Test Examples**:

```typescript
// Property 1: Authentication Rejection Universality
test('all endpoints reject invalid credentials consistently', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom('/api/debug-webhook-key', '/api/fix-subscription', '/api/llm/metrics', '/api/cron/keep-alive'),
      fc.oneof(
        fc.constant(undefined), // Missing header
        fc.string(), // Random invalid value
        fc.constant('Bearer wrong-secret')
      ),
      async (endpoint, authHeader) => {
        const response = await fetch(endpoint, {
          headers: authHeader ? { 'authorization': authHeader } : {}
        });
        expect([401, 403]).toContain(response.status);
      }
    ),
    { numRuns: 100 }
  );
});
// Feature: security-hardening, Property 1: Authentication Rejection Universality

// Property 2: Cron Authentication Environment Consistency
test('cron auth is consistent across environments', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom('development', 'production', 'test'),
      fc.string().filter(s => s !== process.env.CRON_SECRET),
      async (nodeEnv, invalidSecret) => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = nodeEnv;
        
        const response = await fetch('/api/cron/keep-alive', {
          headers: { 'authorization': `Bearer ${invalidSecret}` }
        });
        
        process.env.NODE_ENV = originalEnv;
        expect(response.status).toBe(401);
      }
    ),
    { numRuns: 100 }
  );
});
// Feature: security-hardening, Property 2: Cron Authentication Environment Consistency

// Property 4: File Size Limit Enforcement
test('file size limits are enforced before processing', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom('document', 'audio'),
      fc.integer({ min: 1, max: 200 }), // Size in MB
      async (fileType, sizeMB) => {
        const maxSize = fileType === 'document' ? 50 : 100;
        const buffer = Buffer.alloc(sizeMB * 1024 * 1024);
        
        const response = await uploadFile(buffer, fileType);
        
        if (sizeMB > maxSize) {
          expect(response.status).toBe(413);
        } else {
          expect(response.status).not.toBe(413);
        }
      }
    ),
    { numRuns: 100 }
  );
});
// Feature: security-hardening, Property 4: File Size Limit Enforcement

// Property 5: MIME Type Detection Consistency
test('MIME detection is deterministic', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.uint8Array({ minLength: 100, maxLength: 1000 }),
      async (buffer) => {
        const result1 = await validateMimeType(Buffer.from(buffer), ['*']);
        const result2 = await validateMimeType(Buffer.from(buffer), ['*']);
        expect(result1.detectedType).toBe(result2.detectedType);
      }
    ),
    { numRuns: 100 }
  );
});
// Feature: security-hardening, Property 5: MIME Type Detection Consistency

// Property 8: Secret Pattern Detection Completeness
test('scanner detects all secret patterns', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom('gsk_', 'sk_test_', 'sk_live_', 're_', 'AIzaSy', 'whsec_'),
      fc.string({ minLength: 20, maxLength: 50 }),
      async (prefix, suffix) => {
        const secret = prefix + suffix;
        const result = await scanForSecrets({ content: secret });
        expect(result.violationsFound).toBeGreaterThan(0);
      }
    ),
    { numRuns: 100 }
  );
});
// Feature: security-hardening, Property 8: Secret Pattern Detection Completeness

// Property 10: Rate Limit Response Format
test('rate limit responses include Retry-After header', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 101, max: 200 }), // Exceed 100 req/min limit
      async (requestCount) => {
        const responses = [];
        for (let i = 0; i < requestCount; i++) {
          responses.push(await fetch('/api/generate'));
        }
        
        const rateLimitedResponse = responses.find(r => r.status === 429);
        if (rateLimitedResponse) {
          expect(rateLimitedResponse.headers.has('retry-after')).toBe(true);
        }
      }
    ),
    { numRuns: 100 }
  );
});
// Feature: security-hardening, Property 10: Rate Limit Response Format
```

### Integration Testing

**Test Coverage**:

1. **Endpoint Security Tests**:
   - Verify all `/api/cron/*` routes reject requests without valid CRON_SECRET
   - Verify all `/api/debug-*` routes require admin + debug secret
   - Verify monitoring endpoints require authentication

2. **File Upload Tests**:
   - Upload files with mismatched MIME types (PDF with .jpg extension)
   - Upload files exceeding size limits
   - Upload files with malicious content

3. **Configuration Tests**:
   - Start application with missing CRON_SECRET (should log warning)
   - Start with placeholder admin IDs (should log warning)
   - Verify NEXT_PUBLIC_ variables don't contain secrets

4. **Git Hook Tests**:
   - Attempt to commit files with secrets (should be blocked)
   - Attempt to commit `dev.db` (should be blocked)
   - Verify pre-push hook runs security scanner

### Manual Security Audit Checklist

**Pre-Deployment**:
- [ ] Run `npm run test:security` and verify no violations
- [ ] Verify `.env` is in `.gitignore`
- [ ] Verify `dev.db` and `prisma/dev.db` are not tracked by git
- [ ] Review all NEXT_PUBLIC_ variables (none should be secrets)
- [ ] Verify admin user IDs are real (not placeholders)

**Post-Deployment**:
- [ ] Rotate all production secrets (see SECRETS_ROTATION.md)
- [ ] Test cron endpoints with invalid secret (should return 401)
- [ ] Test debug endpoints without admin auth (should return 403)
- [ ] Verify monitoring endpoints require authentication
- [ ] Test file upload with invalid MIME type (should return 400)

**Ongoing Monitoring**:
- [ ] Review audit logs weekly for authentication failures
- [ ] Monitor rate limiting metrics
- [ ] Check for MIME type validation warnings
- [ ] Verify no secrets in recent commits

### Test Execution

```bash
# Run all tests
npm run test

# Run security-specific tests
npm run test:security

# Run property-based tests only
npm run test:properties

# Run integration tests
npm run test:integration

# Manual security scan
npm run test:pii-scanner
npm run test:email-placeholders
```

### Success Criteria

- All property-based tests pass with 100 iterations
- All integration tests pass
- Security scanner reports zero violations
- Manual audit checklist completed
- All production secrets rotated
- Zero authentication bypass vulnerabilities
- Zero secret exposure in client bundle or git history

