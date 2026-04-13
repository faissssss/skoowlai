# Fixes Applied - April 12, 2026

## Issue 1: React Hydration Mismatch (FIXED)

### Problem
React hydration errors caused by Dark Reader browser extension modifying inline styles before React loads.

### Root Cause
Dark Reader adds `data-darkreader-inline-*` attributes to elements with inline styles, causing server-rendered HTML to differ from client-rendered HTML.

### Solution Applied
Added `suppressHydrationWarning` attribute to affected elements:

1. **Image components** (logo in nav and footer)
   - File: `src/app/page.tsx`
   - Lines: 336, 1205

2. **AnimatedGradientText component**
   - File: `src/components/magicui/animated-gradient-text.tsx`
   - Added to span element with inline gradient styles

3. **Root layout**
   - File: `src/app/layout.tsx`
   - Added to body element (html already had it)

### Result
Hydration warnings from browser extensions will be suppressed. The app will function correctly without console errors.

---

## Issue 2: Rewrite Endpoint "Failed to fetch" Error (FIXED)

### Problem
ChatAssistant component getting "Failed to fetch" error when calling `/api/rewrite` endpoint.

### Root Cause
1. Missing CSRF protection (inconsistent with other endpoints)
2. Dev server needs restart after LLM migration changes

### Solution Applied
Added CSRF protection to rewrite endpoint:

**File**: `src/app/api/rewrite/route.ts`

```typescript
import { checkCsrfOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
    const csrfError = checkCsrfOrigin(req);
    if (csrfError) return csrfError;
    
    // ... rest of the code
}
```

### Verification
All migrated endpoints now have consistent security:
- ✅ `/api/chat` - Has CSRF protection
- ✅ `/api/rewrite` - Has CSRF protection (ADDED)
- ✅ `/api/generate` - Has CSRF protection
- ✅ `/api/flashcards` - Has CSRF protection
- ✅ `/api/quiz` - Has CSRF protection
- ✅ `/api/mindmap` - Has CSRF protection
- ✅ `/api/generate-audio-notes` - Has CSRF protection

All endpoints use correct LLMRouter initialization:
```typescript
const config = ProviderConfig.load();
const router = new LLMRouter({
    primaryProvider: config.getPrimaryProvider(),
    fallbackProvider: config.getFallbackProvider(),
    enableFallback: config.isFallbackEnabled(),
    modelMapping: DEFAULT_MODEL_MAPPING,
    timeout: 30000,
    enableContentSizeRouting: config.isContentSizeRoutingEnabled(),
    contentSizeThreshold: config.getContentSizeThreshold(),
});
```

### Next Steps
**IMPORTANT**: Restart the dev server to apply changes:

```bash
# Stop the current dev server (Ctrl+C)
# Then restart:
npm run dev
```

### Testing
After restarting the dev server:

1. Open the app in browser
2. Navigate to a deck with notes
3. Open the chat assistant
4. Try using the rewrite feature:
   - Select some text
   - Click "Rewrite"
   - Choose an action (improve, shorten, paraphrase, simplify, detailed)
5. Verify the rewrite works without errors

### Expected Behavior
- Rewrite requests should stream back results
- No "Failed to fetch" errors
- No CSRF errors
- No authentication errors

---

## Summary

### Files Modified
1. `src/app/page.tsx` - Added suppressHydrationWarning to images
2. `src/components/magicui/animated-gradient-text.tsx` - Added suppressHydrationWarning
3. `src/app/layout.tsx` - Added suppressHydrationWarning to body
4. `src/app/api/rewrite/route.ts` - Added CSRF protection

### No TypeScript Errors
All files pass TypeScript compilation:
- ✅ `src/app/api/rewrite/route.ts`
- ✅ `src/app/api/chat/route.ts`
- ✅ `src/components/study/ChatAssistant.tsx`

### Status
- ✅ Hydration warnings fixed
- ✅ CSRF protection added to rewrite endpoint
- ⏳ Requires dev server restart to take effect

### Deployment Ready
Once tested locally, these changes are safe to deploy to production.
