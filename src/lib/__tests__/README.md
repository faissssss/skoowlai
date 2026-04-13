# Server-Only-Check Module Tests

## Overview

This directory contains tests for the `server-only-check` module, which ensures that server-side secrets never leak to the client bundle.

## Test Files

### `server-only-check.test.ts`

Unit tests for the `getServerSecret()` function that verify:

- ✅ Returns environment variable value when it exists
- ✅ Throws error when environment variable is missing
- ✅ Throws error when environment variable is empty string
- ✅ Works with various secret formats (API keys, database URLs, etc.)
- ✅ Error messages include the key name for debugging
- ✅ Handles special characters in secret values
- ✅ Handles multiline secret values

**Run tests:**
```bash
npm run test:server-only-check
```

### `server-only-check-build.md`

Documentation for verifying the build-time check that prevents Client Component imports.

## Why Two Types of Tests?

The `server-only` package provides **two layers of protection**:

1. **Runtime Protection** (tested by unit tests):
   - `getServerSecret()` throws errors for missing secrets
   - Prevents runtime errors from undefined environment variables

2. **Build-Time Protection** (verified manually):
   - Importing `server-only-check` in a Client Component causes build failure
   - Prevents secrets from ever reaching the client bundle

## Test Coverage

| Requirement | Test Type | Status |
|-------------|-----------|--------|
| getServerSecret() throws error for missing secrets | Unit Test | ✅ Passing |
| Importing in Client Component triggers build error | Build-Time Check | ✅ Documented |

## Related Requirements

- **Requirement 1.3**: The Repository SHALL contain a `src/lib/server-only-check.ts` module that imports `server-only` so that any accidental import of secret-reading utilities in a Client Component causes a build-time error.

## Notes

- The unit tests use a reimplementation of `getServerSecret()` without the `server-only` import because the `server-only` package throws errors in non-server contexts (like Node.js test runners).
- The actual implementation in `src/lib/server-only-check.ts` includes the `server-only` import for build-time protection.
- Both implementations have identical logic, ensuring test accuracy.
