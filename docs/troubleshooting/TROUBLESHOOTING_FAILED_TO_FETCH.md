# Troubleshooting "Failed to Fetch" Error

## Current Status
Still getting "Failed to fetch" error on `/api/rewrite` endpoint despite adding error handling.

## Diagnostic Steps

### Step 1: Verify Dev Server is Running
**CRITICAL**: Have you restarted the dev server after making the changes?

```bash
# Stop the current dev server (Ctrl+C in the terminal)
# Then restart:
npm run dev
```

**Why this matters**: Environment variable changes and code changes require a server restart to take effect.

### Step 2: Test Simple Endpoint
Open in browser: `http://localhost:3000/api/test-rewrite-health`

Expected response:
```json
{
  "status": "ok",
  "message": "Test endpoint is working",
  "timestamp": "2026-04-12T..."
}
```

If this works, the Next.js API routes are functioning correctly.

### Step 3: Check Server Console
Look at the terminal where `npm run dev` is running. You should see:
```
🟢 [REWRITE] Module loaded successfully
```

If you DON'T see this, the module failed to load (import error).

### Step 4: Check Browser Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Try the rewrite feature
4. Look for the `/api/rewrite` request
5. Check the response:
   - **Status Code**: What is it? (500, 403, 404, etc.)
   - **Response Body**: What does it say?
   - **Request Headers**: Is Origin header present?

### Step 5: Check for CORS/CSRF Issues
The endpoint now has CSRF protection. Make sure:
- You're accessing the app from `http://localhost:3000` (not a different port)
- The request has an `Origin` header matching the server origin
- You're logged in (authentication required)

### Step 6: Test Without Authentication
Create a test endpoint without auth to isolate the issue:

```typescript
// src/app/api/test-rewrite-no-auth/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        return NextResponse.json({
            status: 'ok',
            received: body,
        });
    } catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
```

Test with:
```javascript
fetch('/api/test-rewrite-no-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: 'data' })
})
```

## Common Causes

### 1. Dev Server Not Restarted
**Solution**: Restart the dev server

### 2. Build Error
Check the terminal for TypeScript or build errors.

**Solution**: Fix any compilation errors

### 3. Import Error
One of the imported modules is failing to load.

**Check**: Look for error messages in the server console when the module loads

### 4. CSRF Protection Blocking Request
The CSRF check is rejecting the request.

**Check**: Look for `🔴 [REWRITE] CSRF check failed` in server console

**Solution**: Make sure you're accessing from the same origin

### 5. Authentication Failing
User is not authenticated.

**Check**: Look for `🔴 [REWRITE] Auth check failed` in server console

**Solution**: Make sure you're logged in

### 6. Configuration Error
`ProviderConfig.load()` is throwing an error.

**Check**: Look for `Failed to load LLM configuration` in server console

**Solution**: Verify all environment variables are set correctly

### 7. Port Mismatch
Frontend is running on a different port than the API.

**Check**: Verify both are on `localhost:3000`

## Debug Checklist

- [ ] Dev server restarted after changes
- [ ] No TypeScript/build errors in terminal
- [ ] Module load message appears in console
- [ ] Test endpoint (`/api/test-rewrite-health`) works
- [ ] Logged in to the application
- [ ] Accessing from `localhost:3000`
- [ ] Browser Network tab shows the request
- [ ] Server console shows request logs

## Next Steps

1. **Restart dev server** (if not done already)
2. Check server console for the module load message
3. Test the simple health endpoint
4. Check browser Network tab for actual HTTP error
5. Report back with:
   - HTTP status code from Network tab
   - Response body from Network tab
   - Any error messages in server console
   - Any error messages in browser console

## Expected Behavior After Fix

When you try to rewrite:
1. Server console shows: `🔵 [REWRITE] POST endpoint called`
2. If CSRF fails: `🔴 [REWRITE] CSRF check failed`
3. If auth fails: `🔴 [REWRITE] Auth check failed`
4. If config fails: `Failed to load LLM configuration: ...`
5. If successful: Streaming response with rewritten text

## Still Not Working?

If you've done all the above and it still doesn't work, the issue might be:
- Next.js caching issue (try deleting `.next` folder)
- Browser caching issue (try hard refresh or incognito mode)
- Proxy/network issue
- Windows-specific file system issue

Try:
```bash
# Stop dev server
# Delete build cache
Remove-Item -Recurse -Force .next
# Restart
npm run dev
```
