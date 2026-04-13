# Schema Verification Script

## Purpose

The `verify-schema.ts` script ensures that the production database schema matches the Prisma schema file. It's designed to prevent deployment of code that expects database columns that don't exist, which would cause runtime errors.

## What It Checks

The script verifies that the User table contains four feature-specific usage date columns:

1. `lastFlashcardUsageDate`
2. `lastQuizUsageDate`
3. `lastMindmapUsageDate`
4. `lastStudyDeckUsageDate`

For each column, it verifies:
- **Existence**: The column exists in the database
- **Type**: The column is `TIMESTAMP(3)` (timestamp without time zone with 3-digit precision)
- **Nullable**: The column allows NULL values

## Usage

### Manual Execution

```bash
npx tsx scripts/verify-schema.ts
```

### In Build Process

The script is designed to be integrated into the build process:

```json
{
  "scripts": {
    "db:migrate": "prisma generate && prisma migrate deploy",
    "db:verify": "tsx scripts/verify-schema.ts",
    "build": "npm run db:migrate && npm run db:verify && next build --webpack"
  }
}
```

This ensures:
1. Migrations are applied first
2. Schema is verified before building
3. Build fails if schema mismatches are detected

## Exit Codes

- **0**: Schema verification passed (all columns exist with correct types)
- **1**: Schema verification failed (missing columns or type mismatches)

## Output Examples

### Success Case

```
🔍 DATABASE SCHEMA VERIFICATION

============================================================

📋 Checking for required columns in User table...

   ✓ lastFlashcardUsageDate
     Type: timestamp without time zone (precision: 3)
     Nullable: YES
   ✓ lastQuizUsageDate
     Type: timestamp without time zone (precision: 3)
     Nullable: YES
   ✓ lastMindmapUsageDate
     Type: timestamp without time zone (precision: 3)
     Nullable: YES
   ✓ lastStudyDeckUsageDate
     Type: timestamp without time zone (precision: 3)
     Nullable: YES

============================================================

✅ SCHEMA VERIFICATION PASSED

All required columns exist with correct types:
  ✓ lastFlashcardUsageDate
  ✓ lastQuizUsageDate
  ✓ lastMindmapUsageDate
  ✓ lastStudyDeckUsageDate

🎉 Database schema matches Prisma schema!
```

### Failure Case (Missing Columns)

```
🔍 DATABASE SCHEMA VERIFICATION

============================================================

📋 Checking for required columns in User table...

   ❌ lastFlashcardUsageDate - MISSING
   ❌ lastQuizUsageDate - MISSING
   ❌ lastMindmapUsageDate - MISSING
   ❌ lastStudyDeckUsageDate - MISSING

============================================================

❌ SCHEMA VERIFICATION FAILED

Errors found:
  - Column lastFlashcardUsageDate does not exist in User table
  - Column lastQuizUsageDate does not exist in User table
  - Column lastMindmapUsageDate does not exist in User table
  - Column lastStudyDeckUsageDate does not exist in User table

💡 Action required:
  Run: npx prisma migrate deploy
  This will apply pending migrations to sync the database schema.
```

### Failure Case (Type Mismatch)

```
🔍 DATABASE SCHEMA VERIFICATION

============================================================

📋 Checking for required columns in User table...

   ⚠️  lastFlashcardUsageDate - TYPE MISMATCH
     Expected: TIMESTAMP(3), nullable
     Actual: timestamp without time zone (precision: 6), nullable: YES

============================================================

❌ SCHEMA VERIFICATION FAILED

Errors found:
  - Column lastFlashcardUsageDate has incorrect precision: 6 (expected: 3)

💡 Action required:
  Run: npx prisma migrate deploy
  This will apply pending migrations to sync the database schema.
```

## Error Handling

The script handles several error scenarios:

1. **Database Connection Errors**: If the script cannot connect to the database, it exits with code 1 and suggests checking the `DATABASE_URL` environment variable.

2. **Missing Columns**: If any of the four required columns are missing, the script lists all missing columns and suggests running `npx prisma migrate deploy`.

3. **Type Mismatches**: If columns exist but have incorrect types or constraints, the script lists the specific mismatches.

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Apply migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      
      - name: Verify schema
        run: npm run db:verify
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      
      - name: Build application
        run: npm run build
```

### Vercel Example

In `package.json`:

```json
{
  "scripts": {
    "build": "npm run db:migrate && npm run db:verify && next build --webpack"
  }
}
```

Vercel will automatically run the build script, which includes schema verification.

## Testing

A test suite is available in `scripts/verify-schema.test.ts`:

```bash
npx tsx scripts/verify-schema.test.ts
```

The test suite verifies:
- Database connection works
- Column detection logic is correct
- Type checking logic is correct
- Error messages are clear and actionable
- Exit codes are correct

## Related Scripts

- **check-schema-before-migration.ts**: Similar script that checks schema but doesn't enforce with exit codes
- **verify-migration-complete.ts**: Comprehensive verification script that also tests Prisma queries
- **test-schema-bug-condition.ts**: Property-based test that verifies the bug condition

## Maintenance

When adding new columns to the Prisma schema that should be verified:

1. Update the `expectedColumns` array in `verify-schema.ts`
2. Update the SQL query to include the new column names
3. Update this documentation
4. Run the test suite to ensure the script still works correctly

## Troubleshooting

### Script fails with "DATABASE_URL not found"

Ensure the `DATABASE_URL` environment variable is set:

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
npx tsx scripts/verify-schema.ts
```

### Script reports missing columns but migration was applied

1. Check the migration history:
   ```sql
   SELECT * FROM _prisma_migrations 
   WHERE migration_name = '20260209000000_add_feature_usage_dates';
   ```

2. Manually verify the columns exist:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'User' 
   AND column_name LIKE 'last%UsageDate';
   ```

3. If columns are missing, re-apply the migration:
   ```bash
   npx prisma migrate deploy
   ```

### Script reports type mismatch

This usually indicates the migration was applied with different parameters. Check:

1. The migration SQL file: `prisma/migrations/20260209000000_add_feature_usage_dates/migration.sql`
2. The Prisma schema: `prisma/schema.prisma`
3. The actual database schema using the SQL query above

If there's a mismatch, you may need to create a new migration to fix the column types.
