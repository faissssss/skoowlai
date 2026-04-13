# Security Layers Analysis

## Overview
This document analyzes the existing security layers in the codebase to identify duplications, overlaps, and potential conflicts.

---

## 🔍 Findings

### 1. **Rate Limiting - THREE LAYERS DETECTED** ⚠️

#### Layer 1: Upstash Redis Rate Limiting (`src/lib/ratelimit.ts`)
- **Purpose**: Prevent API abuse and DoS attacks
- **Scope**: Per-user or per-IP
- **Limits**: 30 requests per 60 seconds (default), customizable
- **Applied to**: 11+ public API routes
- **Technology**: Upstash Redis with sliding window
- **Key Features**:
  - Prefers user ID over IP for authenticated users
  - Returns HTTP 429 with Retry-After header
  - Graceful degradation if Redis fails

#### Layer 2: Feature-Based Daily Limits (`src/lib/featureLimits.ts`)
- **Purpose**: Enforce subscription-based feature usage limits
- **Scope**: Per-user, per-feature, per-day
- **Limits**:
  - **Free users**: 3 study decks, 5 flashcards, 5 quizzes, 5 mindmaps, 20 chats per day
  - **Pro users**: Unlimited (except chat: 100/day)
- **Applied to**: chat, flashcards, quiz, mindmap, studyDeck
- **Technology**: Database-backed counters with daily reset
- **Key Features**:
  - Resets at midnight
  - Tracks usage per feature type
  - Returns HTTP 429 with upgrade prompt

#### Layer 3: Study Deck Daily Limits (`src/lib/usageVerifier.ts`)
- **Purpose**: Enforce daily study deck creation limits (legacy/beta limits)
- **Scope**: Per-user, per-day
- **Limits**:
  - **Free users**: 3 items per day (combined total)
  - **Pro users**: Unlimited
- **Applied to**: `/api/generate`, `/api/generate-audio-notes`
- **Technology**: Database-backed counter with daily reset
- **Key Features**:
  - Also validates file sizes (10MB docs, 50MB audio)
  - Also validates YouTube duration (60 min max)
  - Returns HTTP 429 with upgrade prompt

---

## 📊 Overlap Analysis

### Rate Limiting Overlap

| Endpoint | Redis Rate Limit | Feature Daily Limit | Study Deck Daily Limit |
|----------|------------------|---------------------|------------------------|
| `/api/chat` | ✅ 30 req/60s | ✅ 20/day (free), 100/day (pro) | ❌ |
| `/api/flashcards` | ✅ 30 req/60s | ✅ 5/day (free), unlimited (pro) | ❌ |
| `/api/quiz` | ✅ 30 req/60s | ✅ 5/day (free), unlimited (pro) | ❌ |
| `/api/mindmap` | ✅ 30 req/60s | ✅ 5/day (free), unlimited (pro) | ❌ |
| `/api/generate` | ✅ 30 req/60s | ❌ | ✅ 3/day (free), unlimited (pro) |
| `/api/generate-audio-notes` | ✅ 30 req/60s | ❌ | ✅ 3/day (free), unlimited (pro) |
| `/api/rewrite` | ✅ 30 req/60s | ❌ | ❌ |
| `/api/feedback` | ✅ 5 req/60s | ❌ | ❌ |
| `/api/bug-report` | ✅ 5 req/60s | ❌ | ❌ |

### Key Observations

1. **No Conflicts**: The three layers serve different purposes and don't conflict:
   - **Redis rate limiting**: Short-term burst protection (seconds/minutes)
   - **Feature limits**: Long-term usage quotas (daily)
   - **Study deck limits**: Legacy daily limits for specific endpoints

2. **Complementary Design**: 
   - Redis catches rapid-fire abuse (30 requests in 60 seconds)
   - Feature limits enforce business model (free vs pro tiers)
   - Study deck limits provide additional file size validation

3. **Different Scopes**:
   - Redis: All authenticated requests
   - Feature limits: Specific feature types (chat, flashcards, etc.)
   - Study deck limits: Only study deck creation endpoints

---

## 🔄 Potential Duplications

### 1. Daily Limit Tracking - MINOR DUPLICATION ⚠️

**Issue**: Two separate systems track daily limits:
- `featureLimits.ts` tracks: flashcard, quiz, mindmap, chat, studyDeck
- `usageVerifier.ts` tracks: dailyUsageCount (study decks)

**Fields in User model**:
```typescript
// From featureLimits.ts
flashcardUsageCount: number
lastFlashcardUsageDate: Date
quizUsageCount: number
lastQuizUsageDate: Date
mindmapUsageCount: number
lastMindmapUsageDate: Date
chatUsageCount: number
lastChatUsageDate: Date

// From usageVerifier.ts
dailyUsageCount: number  // Study decks
lastStudyDeckUsageDate: Date
lastUsageDate: Date (legacy)
```

**Analysis**: 
- `featureLimits.ts` has a `studyDeck` feature type that uses `dailyUsageCount`
- `usageVerifier.ts` also uses `dailyUsageCount` for study deck limits
- **This is intentional overlap** - both systems track the same counter for study decks
- No conflict because they're checking the same field

### 2. File Size Validation - DUPLICATION DETECTED ⚠️

**Issue**: Two separate systems validate file sizes:

#### System 1: `usageVerifier.ts`
```typescript
MAX_DOC_SIZE_MB: 10   // 10MB for documents
MAX_AUDIO_SIZE_MB: 50 // 50MB for audio
```

#### System 2: `size-validator.ts` (NEW - from security hardening)
```typescript
MAX_DOCUMENT_SIZE: 50 * 1024 * 1024  // 50MB for documents
MAX_AUDIO_SIZE: 100 * 1024 * 1024    // 100MB for audio
```

**Conflict**: Different limits!
- Documents: 10MB (old) vs 50MB (new) ✅ **New is more permissive**
- Audio: 50MB (old) vs 100MB (new) ✅ **New is more permissive**

**Applied to**:
- `usageVerifier.ts`: `/api/generate`, `/api/generate-audio-notes`
- `size-validator.ts`: `/api/generate`, `/api/generate-audio-notes`

**Impact**: Both validators run on the same endpoints!
- Request hits `size-validator.ts` first (50MB/100MB limits)
- Then hits `usageVerifier.ts` (10MB/50MB limits)
- **The stricter limit (usageVerifier) will always trigger first**

---

## ⚠️ Issues & Recommendations

### Issue 1: Conflicting File Size Limits

**Problem**: Two validators with different limits on the same endpoints.

**Current Behavior**:
- Documents: Rejected at 10MB (usageVerifier), even though size-validator allows 50MB
- Audio: Rejected at 50MB (usageVerifier), even though size-validator allows 100MB

**Recommendation**: 
```typescript
// Option A: Remove old limits from usageVerifier.ts
// Keep only daily limit checking, remove file size validation
// Let size-validator.ts handle all file size validation

// Option B: Align the limits
// Update usageVerifier.ts to match size-validator.ts:
MAX_DOC_SIZE_MB: 50   // Match size-validator
MAX_AUDIO_SIZE_MB: 100 // Match size-validator

// Option C: Remove size validation from usageVerifier entirely
// Since size-validator.ts now handles this with MIME validation
```

**Recommended Action**: **Option C** - Remove file size validation from `usageVerifier.ts`
- Keeps concerns separated
- `usageVerifier.ts` focuses on daily limits and subscription checks
- `size-validator.ts` + `mime-validator.ts` handle all file validation

### Issue 2: Redundant Daily Limit Systems

**Problem**: `featureLimits.ts` and `usageVerifier.ts` both track study deck limits.

**Current Behavior**:
- Both use the same database field (`dailyUsageCount`)
- Both reset at midnight
- Both check subscription status
- **No actual conflict** - they're synchronized

**Recommendation**: 
- **Keep as-is** - This is intentional and working correctly
- `usageVerifier.ts` is for `/api/generate` (study deck creation)
- `featureLimits.ts` is for other features (chat, flashcards, etc.)
- The overlap on `studyDeck` is by design

### Issue 3: Multiple Rate Limit Error Messages

**Problem**: Users might see different error messages for the same "too many requests" scenario.

**Current Behavior**:
- Redis rate limit: "Too many requests. You're making requests too quickly."
- Feature limit: "Daily limit reached. Upgrade to Student plan for unlimited access!"
- Study deck limit: "Daily limit reached. Upgrade to Student plan for unlimited access!"

**Recommendation**:
- **Keep as-is** - Different messages for different limits is actually helpful
- Redis: Short-term abuse (wait a minute)
- Feature/Study: Daily quota (upgrade or wait until tomorrow)

---

## ✅ What's Working Well

1. **Layered Defense**: Multiple security layers provide defense in depth
2. **No Breaking Conflicts**: The systems don't break each other
3. **Clear Separation**: Each layer has a distinct purpose
4. **Graceful Degradation**: Redis rate limiting fails open if unavailable

---

## 🎯 Action Items

### ✅ Completed
- [x] **Fixed file size limit conflict**: Updated `usageVerifier.ts` to match `size-validator.ts` limits (50MB docs, 100MB audio)

### Medium Priority
- [ ] **Document the layered approach**: Add comments explaining why multiple rate limiting systems exist
- [ ] **Consider consolidation**: Evaluate if `usageVerifier.ts` should be merged into `featureLimits.ts`

### Low Priority
- [ ] **Add monitoring**: Track which rate limit triggers most often
- [ ] **Consider caching**: Cache subscription status to reduce DB queries

---

## 📝 Summary

**Total Security Layers**: 3 rate limiting systems + 2 file validation systems

**Conflicts Found**: ~~1 (file size limits)~~ **FIXED** ✅

**Duplications Found**: 1 (daily limit tracking - intentional)

**Overall Assessment**: ✅ **Excellent**
- The layered approach is sound
- File size conflict has been resolved
- No critical issues
- Systems are complementary, not conflicting

**Applied Fix**: Updated `usageVerifier.ts` file size limits to match `size-validator.ts`:
```typescript
// In usageVerifier.ts (UPDATED)
export const USAGE_LIMITS = {
    DAILY_LIMIT: 3,
    MAX_DOC_SIZE_MB: 50,   // ✅ Changed from 10 to 50
    MAX_AUDIO_SIZE_MB: 100, // ✅ Changed from 50 to 100
    MAX_YOUTUBE_DURATION_SEC: 3600,
} as const;
```

**Result**: Consistent file size limits across the application. Both validators now enforce the same limits.
