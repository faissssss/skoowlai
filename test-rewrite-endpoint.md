# Testing Rewrite Endpoint

## Issue
Getting "Failed to fetch" error when calling `/api/rewrite` endpoint from ChatAssistant component.

## Changes Made

1. Added CSRF protection to `/api/rewrite` endpoint (matching `/api/chat`)
2. Both endpoints now have consistent security checks

## To Test

1. Restart the dev server:
   ```bash
   npm run dev
   ```

2. Open the app and try using the rewrite feature in the chat assistant

3. Check browser console for any errors

4. Check server logs for any errors

## Expected Behavior

- The rewrite endpoint should accept POST requests with:
  ```json
  {
    "text": "some text to rewrite",
    "action": "improve" | "shorten" | "paraphrase" | "simplify" | "detailed",
    "deckId": "optional-deck-id"
  }
  ```

- It should return a streaming text response

## Common Issues

1. **Dev server not restarted**: The LLM migration changes require a server restart
2. **Missing environment variables**: Check that GROQ_API_KEY and other LLM config vars are set
3. **CSRF protection**: The endpoint now requires same-origin requests
4. **Authentication**: User must be signed in

## Debugging

If the error persists, check:

1. Server console for error messages
2. Browser Network tab to see the actual HTTP error
3. Environment variables are loaded correctly
4. No TypeScript compilation errors

## Files Modified

- `src/app/api/rewrite/route.ts` - Added CSRF protection
- `src/components/magicui/animated-gradient-text.tsx` - Added suppressHydrationWarning
- `src/app/layout.tsx` - Added suppressHydrationWarning to body
- `src/app/page.tsx` - Added suppressHydrationWarning to images
