# Bug Condition Exploration Test Documentation

## Overview

This document describes the bug condition exploration test for the database schema sync fix. The test validates that migration `20260209000000_add_feature_usage_dates` has been successfully applied to the production database.

## Test Purpose

The test encodes the **expected behavior** after the fix is applied:
1. All four usage date columns should exist in the User table
2. Authenticated API requests should work correctly without P2022 errors
3. Prisma queries should be able to read and write to the new columns

## Bug Condition (What Was Fixed)

The bug manifested when the production database was missing four columns that existed in the Prisma schema:
- `User.lastFlashcardUsageDate` (TIMESTAMP)
- `User.lastQuizUsageDate` (TIMESTAMP)
- `User.lastMindmapUsageDate` (TIMESTAMP)
- `User.lastStudyDeckUsageDate` (TIMESTAMP)

This caused all authenticated endpoints to fail with `PrismaClientKnownRequestError` (code P2022):
```
Error: The column User.lastFlashcardUsageDate does not exist in the current database.
```

### Affected Endpoints
- `/api/generate` (document upload, YouTube processing)
- `/api/workspaces`
- `/api/flashcards`
- `/api/quiz`
- `/api/mindmap`
- `/api/chat`

### Impact
- **Severity**: Production-critical
- **Affected Users**: 100% of authenticated users
- **Symptoms**: "Upload Failed - Unauthorized" errors, 401/500 status codes

## Expected Behavior (After Fix)

### 1. Schema Columns Exist
All four columns should be present in the `User` table with the correct data types:
- **Type**: `timestamp without time zone` (TIMESTAMP(3) in Prisma)
- **Nullable**: YES (columns are optional)
- **Default**: NULL

### 2. Authenticated API Requests Work
Prisma queries that select from the User table should succeed without errors:
```typescript
const user = await prisma.user.findUnique({
  where: { clerkId: userId },
  select: {
    lastFlashcardUsageDate: true,
    lastQuizUsageDate: true,
    lastMindmapUsageDate: true,
    lastStudyDeckUsageDate: true,
  }
});
// Should return user object without P2022 error
```

### 3. Column Operations Work
The application should be able to:
- **Query** users by usage dates
- **Filter** users with OR conditions on multiple date columns
- **Update** usage dates when features are used
- **Read** NULL values for users who haven't used features yet

### 4. Backward Compatibility Preserved
The legacy `lastUsageDate` column should continue to work as a fallback:
```typescript
// From src/lib/featureLimits.ts line 103
const lastUsed = user.lastFlashcardUsageDate || user.lastUsageDate;
```

## Test Implementation

### Test Script: `scripts/test-schema-bug-condition.ts`

The test performs four validation checks:

#### Test 1: Schema Columns Existence
Queries `information_schema.columns` to verify all four columns exist:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'User'
  AND column_name IN (
    'lastFlashcardUsageDate',
    'lastQuizUsageDate',
    'lastMindmapUsageDate',
    'lastStudyDeckUsageDate'
  );
```
**Expected**: Returns 4 rows

#### Test 2: Authenticated API Requests
Executes a Prisma query that would fail with P2022 if columns don't exist:
```typescript
const userCount = await prisma.user.count({
  where: {
    OR: [
      { lastFlashcardUsageDate: { not: null } },
      { lastQuizUsageDate: { not: null } },
      { lastMindmapUsageDate: { not: null } },
      { lastStudyDeckUsageDate: { not: null } }
    ]
  }
});
```
**Expected**: Query succeeds without P2022 error

#### Test 3: Individual Column Queries
Tests each column individually to ensure they're all queryable:
```typescript
for (const column of columns) {
  const count = await prisma.user.count({
    where: { [column]: { not: null } }
  });
}
```
**Expected**: All queries succeed

#### Test 4: Column Update Operations
Tests that the application can update usage dates:
```typescript
const updated = await prisma.user.update({
  where: { id: userId },
  data: { lastFlashcardUsageDate: new Date() }
});
```
**Expected**: Update succeeds without error

## Running the Test

```bash
npx tsx scripts/test-schema-bug-condition.ts
```

### Expected Output (When Bug is Fixed)
```
✅ ALL TESTS PASSED

Expected Behavior Confirmed:
  ✓ All four columns exist in the User table
  ✓ Authenticated API requests work correctly
  ✓ No P2022 errors detected
  ✓ Column update operations succeed

🎉 The bug has been successfully fixed!
```

### Output if Bug Still Exists
```
❌ TESTS FAILED

Bug Condition Detected:
  ✗ Schema mismatch between Prisma schema and database
  ✗ Missing columns causing P2022 errors
  ✗ Authenticated endpoints will fail

⚠️  The bug still exists - migration needs to be applied!
```

## Test Results

**Test Date**: April 13, 2026  
**Status**: ✅ PASSED  
**Migration Applied**: 20260209000000_add_feature_usage_dates  

All four columns were found in the database:
- `lastFlashcardUsageDate`: timestamp without time zone (nullable: YES)
- `lastQuizUsageDate`: timestamp without time zone (nullable: YES)
- `lastMindmapUsageDate`: timestamp without time zone (nullable: YES)
- `lastStudyDeckUsageDate`: timestamp without time zone (nullable: YES)

Authenticated API requests work correctly with no P2022 errors detected.

## Migration Details

### Migration File
`prisma/migrations/20260209000000_add_feature_usage_dates/migration.sql`

### Migration SQL
```sql
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastFlashcardUsageDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastQuizUsageDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastMindmapUsageDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastStudyDeckUsageDate" TIMESTAMP(3);
```

### Idempotency
The migration uses `IF NOT EXISTS` clauses, making it safe to run multiple times without errors.

## Related Files

- **Test Script**: `scripts/test-schema-bug-condition.ts`
- **Migration File**: `prisma/migrations/20260209000000_add_feature_usage_dates/migration.sql`
- **Verification Script**: `scripts/verify-migration-complete.ts`
- **Usage Tracking**: `src/lib/featureLimits.ts` (lines 72, 79, 86, 99, 174-178)
- **Usage Verifier**: `src/lib/usageVerifier.ts` (lines 98, 231)

## Conclusion

The bug condition exploration test confirms that the database schema sync issue has been resolved. All four usage date columns are present in the database, and authenticated API requests work correctly without P2022 errors. The migration was successfully applied to production.
