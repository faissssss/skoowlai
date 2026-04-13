# Build-Time Check for server-only-check Module

## Overview

The `server-only-check` module imports the `server-only` package, which is designed to prevent accidental imports in Client Components. This is a **build-time check** that cannot be tested with unit tests.

## How to Verify

To verify that the build-time check works correctly:

### 1. Create a Test Client Component

Create a file `src/app/test-client-import.tsx`:

```typescript
'use client';

import { getServerSecret } from '@/lib/server-only-check';

export default function TestClientComponent() {
  // This should cause a build error
  const secret = getServerSecret('TEST_SECRET');
  return <div>Client Component</div>;
}
```

### 2. Run the Build

```bash
npm run build
```

### 3. Expected Result

The build should **fail** with an error message similar to:

```
Error: This module cannot be imported from a Client Component module. 
It should only be used from a Server Component.
```

### 4. Clean Up

After verifying the error, delete the test file:

```bash
rm src/app/test-client-import.tsx
```

## Why This Works

The `server-only` package uses Node.js module resolution to detect when it's being imported in a client-side context. Next.js's build process:

1. Analyzes all components marked with `'use client'`
2. Bundles them for the browser
3. Detects the `server-only` import during bundling
4. Throws a build error before the code reaches production

This ensures that server-only secrets and utilities can never accidentally leak to the client bundle.

## Validation Status

- ✅ Unit tests verify `getServerSecret()` throws errors for missing secrets
- ✅ Build-time check prevents Client Component imports (verified manually)
- ✅ Requirement 1.3 satisfied: Server-only secrets remain server-side

## Related Requirements

- **Requirement 1.3**: The Repository SHALL contain a `src/lib/server-only-check.ts` module that imports `server-only` so that any accidental import of secret-reading utilities in a Client Component causes a build-time error.
