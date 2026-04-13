# Emergency Rollback Guide

## Overview

This guide provides step-by-step instructions for rolling back migration `20260209000000_add_feature_usage_dates` in case of unexpected issues after deployment.

## When to Use Rollback

Execute the rollback procedure if you encounter any of the following situations after deploying the migration:

### Critical Issues (Immediate Rollback)
- **Application crashes or fails to start** after migration deployment
- **Database corruption or data integrity issues** detected
- **Severe performance degradation** (response times >5x normal)
- **Complete feature outage** affecting all users
- **Data loss** or unexpected data modifications

### Serious Issues (Consider Rollback)
- **Error rate spike** (>10% of requests failing)
- **Significant increase in P2022 errors** (indicates schema mismatch)
- **User-reported issues** increasing rapidly (>50% increase)
- **Database connection pool exhaustion**
- **Unexpected behavior** in feature usage tracking

### Monitor Before Deciding (May Not Require Rollback)
- **Minor error rate increase** (<5% of requests)
- **Isolated user reports** (affecting <1% of users)
- **Performance degradation** (<2x normal response times)
- **Non-critical feature issues** (e.g., analytics not updating)

## Pre-Rollback Checklist

Before executing the rollback, complete these critical steps:

### 1. Create Database Backup
```bash
# For PostgreSQL (adjust for your database)
pg_dump $DATABASE_URL > backup_before_rollback_$(date +%Y%m%d_%H%M%S).sql

# Verify backup was created
ls -lh backup_before_rollback_*.sql
```

### 2. Enable Maintenance Mode
- Put application in maintenance mode to stop accepting new traffic
- Display maintenance page to users
- This prevents data inconsistencies during rollback

### 3. Document the Issue
Create an incident report documenting:
- **Timestamp** when issue was detected
- **Symptoms** observed (error messages, user reports, metrics)
- **Impact** (number of users affected, features impacted)
- **Root cause hypothesis** (if known)
- **Decision to rollback** and who authorized it

### 4. Notify Stakeholders
- Alert development team
- Notify operations/DevOps team
- Inform customer support team
- Update status page (if applicable)

## Rollback Procedure

### Step 1: Run Rollback Script

Execute the rollback script to remove the four columns:

```bash
# Navigate to project root
cd /path/to/project

# Run rollback script
npx tsx scripts/rollback-migration.ts
```

**Expected Output:**
```
⚠️  EMERGENCY ROLLBACK - Migration 20260209000000

============================================================

🔍 Checking current database state...

Found 4 column(s) to remove:

  - lastFlashcardUsageDate (timestamp without time zone, nullable: YES)
  - lastMindmapUsageDate (timestamp without time zone, nullable: YES)
  - lastQuizUsageDate (timestamp without time zone, nullable: YES)
  - lastStudyDeckUsageDate (timestamp without time zone, nullable: YES)

⚠️  WARNING: This will permanently remove these columns!
   Make sure you have a database backup before proceeding.

============================================================

🔄 Executing rollback SQL...

✓ Rollback SQL executed successfully

🔍 Verifying columns were removed...

✅ ROLLBACK COMPLETED SUCCESSFULLY

All four columns have been removed from the User table.
```

### Step 2: Update Prisma Migrations Table

Remove the migration record to allow re-applying it later:

```bash
# Connect to database and run:
npx prisma db execute --stdin <<EOF
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260209000000_add_feature_usage_dates';
EOF
```

**Verification:**
```bash
# Check migration was removed
npx prisma db execute --stdin <<EOF
SELECT migration_name, finished_at, rolled_back_at 
FROM "_prisma_migrations" 
WHERE migration_name = '20260209000000_add_feature_usage_dates';
EOF
```

Expected: No rows returned (migration record removed)

### Step 3: Revert Application Code

Deploy the previous version of the application (before the migration was added):

```bash
# Find the commit before migration was added
git log --oneline --all --grep="20260209000000" --grep="feature usage dates" -i

# Checkout the commit BEFORE the migration
git checkout <previous-commit-hash>

# Or revert the specific commit
git revert <migration-commit-hash>

# Push to trigger deployment
git push origin main
```

**Critical:** Ensure the reverted code does NOT include:
- The four columns in `prisma/schema.prisma`
- Any code that references these columns
- The migration file `prisma/migrations/20260209000000_add_feature_usage_dates/`

### Step 4: Regenerate Prisma Client

After reverting the code, regenerate the Prisma client:

```bash
# Regenerate Prisma client without the four columns
npx prisma generate

# Verify schema matches database
npx tsx scripts/verify-schema.ts
```

Expected: Schema verification should pass (no missing columns)

### Step 5: Deploy Application

Deploy the reverted application:

```bash
# If using Vercel
vercel --prod

# If using other platforms, follow your deployment process
npm run build
npm run deploy
```

### Step 6: Verify Application Functionality

Test all affected endpoints to ensure they work correctly:

```bash
# Run post-rollback verification tests
npx tsx scripts/test-endpoints-post-migration.ts
```

**Manual Testing:**
1. **File Upload**: Upload a PDF to `/api/generate` - should succeed
2. **Workspace Access**: Navigate to `/api/workspaces` - should return workspaces
3. **Flashcard Generation**: Generate flashcards - should succeed
4. **Quiz Generation**: Generate a quiz - should succeed
5. **Mindmap Generation**: Generate a mindmap - should succeed
6. **Chat Feature**: Send a chat message - should succeed

### Step 7: Disable Maintenance Mode

Once verification is complete:
- Remove maintenance mode
- Allow users to access the application
- Monitor error rates closely

## Post-Rollback Monitoring

### Immediate Checks (First 5 Minutes)
- ✅ No P2022 errors in application logs
- ✅ Error rate returns to normal (<1%)
- ✅ All endpoints responding successfully
- ✅ Database connection pool stable

### Short-Term Monitoring (First Hour)
- Monitor error rates for all authenticated endpoints
- Track user-reported issues
- Check database performance metrics
- Verify usage tracking is working correctly

### Long-Term Monitoring (First 24 Hours)
- Continue monitoring error rates
- Analyze user feedback
- Review application performance metrics
- Document any lingering issues

## Root Cause Investigation

After successful rollback, investigate the root cause:

### 1. Review Application Logs
```bash
# Check for errors around deployment time
grep -i "error\|fail\|p2022" logs/application.log | tail -100

# Check for migration-related errors
grep -i "migration\|prisma\|schema" logs/application.log | tail -100
```

### 2. Analyze Database Metrics
- Query performance before/after migration
- Connection pool usage
- Lock contention
- Slow query logs

### 3. Review Migration Process
- Did `prisma migrate deploy` complete successfully?
- Were there any warnings or errors during migration?
- Was the schema verification step executed?
- Did the build process complete without errors?

### 4. Check for Schema Mismatches
```bash
# Compare Prisma schema with actual database
npx prisma db pull --print

# Compare with prisma/schema.prisma
diff <(npx prisma db pull --print) prisma/schema.prisma
```

### 5. Document Findings
Create a post-incident report including:
- **Timeline** of events
- **Root cause** identified
- **Impact** assessment
- **Lessons learned**
- **Prevention measures** for future deployments

## Re-Attempting the Migration

Before attempting the migration again:

### 1. Fix Root Cause
Address the issues identified in the investigation:
- Fix build script errors
- Improve schema verification
- Add pre-deployment checks
- Enhance monitoring and alerting

### 2. Test in Staging
- Apply migration to staging environment
- Run full test suite
- Verify schema consistency
- Monitor for 24 hours

### 3. Prepare for Production
- Create fresh database backup
- Schedule deployment during low-traffic period
- Prepare rollback plan
- Alert stakeholders

### 4. Deploy with Monitoring
- Apply migration to production
- Monitor error rates in real-time
- Verify schema consistency immediately
- Test all affected endpoints
- Keep rollback script ready

## Rollback SQL Reference

If you need to manually execute the rollback SQL:

```sql
-- Remove the four feature-specific usage date columns
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "lastFlashcardUsageDate",
  DROP COLUMN IF EXISTS "lastQuizUsageDate",
  DROP COLUMN IF EXISTS "lastMindmapUsageDate",
  DROP COLUMN IF EXISTS "lastStudyDeckUsageDate";

-- Verify columns were removed
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'User'
  AND column_name IN (
    'lastFlashcardUsageDate',
    'lastQuizUsageDate',
    'lastMindmapUsageDate',
    'lastStudyDeckUsageDate'
  );
-- Expected: 0 rows

-- Remove migration record (optional)
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260209000000_add_feature_usage_dates';
```

## Emergency Contacts

In case of critical issues during rollback:

- **Database Administrator**: [Contact Info]
- **DevOps Lead**: [Contact Info]
- **Engineering Manager**: [Contact Info]
- **On-Call Engineer**: [Contact Info]

## Additional Resources

- [Prisma Migration Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Database Backup Best Practices](https://www.postgresql.org/docs/current/backup.html)
- [Incident Response Playbook](docs/incident-response.md)
- [Deployment Checklist](docs/deployment-checklist.md)

---

**Last Updated**: 2026-04-12  
**Document Owner**: Engineering Team  
**Review Frequency**: After each migration incident
