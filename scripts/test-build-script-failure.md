# Build Script Failure Test

## Purpose
This document describes how to test that the build script fails when schema verification fails.

## Updated Build Process

The build script has been updated to include explicit schema verification:

```json
{
  "build": "npm run db:migrate && npm run db:verify && next build --webpack",
  "db:migrate": "prisma generate && prisma migrate deploy",
  "db:verify": "tsx scripts/verify-schema.ts"
}
```

## How It Works

1. **db:migrate**: Runs `prisma generate` and `prisma migrate deploy` to apply pending migrations
2. **db:verify**: Runs the schema verification script to check that all required columns exist
3. **next build**: Only runs if both previous steps succeed (exit code 0)

## Failure Behavior

If schema verification fails:
- The `db:verify` script exits with code 1
- The build process stops immediately
- The Next.js build does NOT run
- The deployment fails with a clear error message

## Testing the Failure Scenario

To test that the build fails when schema is out of sync:

### Option 1: Simulate Missing Column (Staging Only)

```sql
-- Connect to staging database
-- Remove one of the required columns
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastFlashcardUsageDate";

-- Now run the build
npm run build

-- Expected: Build fails with schema verification error
-- The db:verify script will detect the missing column and exit with code 1
```

### Option 2: Test with Modified Verification Script

Temporarily modify `scripts/verify-schema.ts` to simulate a failure:

```typescript
// Add this at the end of verifySchema() function, before the success case
if (process.env.TEST_SCHEMA_FAILURE === 'true') {
  console.log('\n❌ SIMULATED SCHEMA VERIFICATION FAILURE\n');
  process.exit(1);
}
```

Then run:
```bash
TEST_SCHEMA_FAILURE=true npm run build
```

Expected: Build fails immediately after db:verify step.

## Verification

After the build script update:

✅ **db:migrate** script runs successfully
✅ **db:verify** script runs successfully  
✅ Schema verification passes (all columns exist)
✅ Build process is now protected against schema mismatches
✅ Future deployments will fail early if schema is out of sync

## Production Safety

This change ensures that:
- Migrations are always applied before building
- Schema consistency is verified before building
- Build fails fast if schema is out of sync
- Prevents deploying code that expects columns that don't exist
- Catches schema mismatches during CI/CD, not in production

## Rollback

If the build script changes cause issues, rollback to the previous version:

```json
{
  "build": "prisma generate && prisma migrate deploy && next build --webpack"
}
```

However, this removes the schema verification safety check.
