import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

/**
 * EMERGENCY ROLLBACK SCRIPT
 * 
 * This script removes the four feature-specific usage date columns added by
 * migration 20260209000000_add_feature_usage_dates.
 * 
 * ⚠️  WARNING: USE ONLY IN EMERGENCY SITUATIONS
 * 
 * When to use this rollback:
 * - Unexpected errors after migration deployment
 * - Data integrity issues detected
 * - Application performance degradation
 * - Increased user-reported issues after deployment
 * 
 * Prerequisites:
 * 1. Create a database backup BEFORE running this script
 * 2. Enable maintenance mode to stop accepting new traffic
 * 3. Document the reason for rollback
 * 
 * Post-rollback steps:
 * 1. Deploy the previous version of the application (before migration was added)
 * 2. Verify application is functioning normally
 * 3. Monitor error rates and user reports
 * 4. Investigate root cause before attempting migration again
 * 
 * Usage:
 *   npx tsx scripts/rollback-migration.ts
 */

async function rollbackMigration() {
  try {
    console.log('⚠️  EMERGENCY ROLLBACK - Migration 20260209000000\n');
    console.log('=' .repeat(60));
    console.log('\n🔍 Checking current database state...\n');
    
    // Columns to remove
    const columnsToRemove = [
      'lastFlashcardUsageDate',
      'lastQuizUsageDate',
      'lastMindmapUsageDate',
      'lastStudyDeckUsageDate'
    ];
    
    // Check which columns currently exist
    const existingColumns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'User'
        AND column_name IN (
          'lastFlashcardUsageDate',
          'lastQuizUsageDate',
          'lastMindmapUsageDate',
          'lastStudyDeckUsageDate'
        )
      ORDER BY column_name;
    `;
    
    if (existingColumns.length === 0) {
      console.log('✓ No columns to remove - migration already rolled back or never applied.\n');
      console.log('=' .repeat(60));
      return;
    }
    
    console.log(`Found ${existingColumns.length} column(s) to remove:\n`);
    existingColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    console.log('\n⚠️  WARNING: This will permanently remove these columns!');
    console.log('   Make sure you have a database backup before proceeding.\n');
    console.log('=' .repeat(60));
    console.log('\n🔄 Executing rollback SQL...\n');
    
    // Execute rollback SQL using idempotent DROP COLUMN IF EXISTS
    await prisma.$executeRaw`
      ALTER TABLE "User"
        DROP COLUMN IF EXISTS "lastFlashcardUsageDate",
        DROP COLUMN IF EXISTS "lastQuizUsageDate",
        DROP COLUMN IF EXISTS "lastMindmapUsageDate",
        DROP COLUMN IF EXISTS "lastStudyDeckUsageDate";
    `;
    
    console.log('✓ Rollback SQL executed successfully\n');
    
    // Verify columns were removed
    console.log('🔍 Verifying columns were removed...\n');
    
    const remainingColumns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'User'
        AND column_name IN (
          'lastFlashcardUsageDate',
          'lastQuizUsageDate',
          'lastMindmapUsageDate',
          'lastStudyDeckUsageDate'
        );
    `;
    
    if (remainingColumns.length > 0) {
      console.log('❌ ROLLBACK VERIFICATION FAILED\n');
      console.log('The following columns still exist:');
      remainingColumns.forEach(col => console.log(`  - ${col.column_name}`));
      console.log('\n💡 Manual intervention may be required.\n');
      process.exit(1);
    }
    
    console.log('✅ ROLLBACK COMPLETED SUCCESSFULLY\n');
    console.log('All four columns have been removed from the User table.\n');
    console.log('=' .repeat(60));
    console.log('\n📋 NEXT STEPS:\n');
    console.log('1. Deploy the previous version of the application');
    console.log('   - Revert to the commit before migration 20260209000000 was added');
    console.log('   - Ensure the Prisma schema does NOT include the four columns');
    console.log('   - Run: git checkout <previous-commit>');
    console.log('   - Deploy the application\n');
    console.log('2. Verify application functionality');
    console.log('   - Test file upload: /api/generate');
    console.log('   - Test workspace access: /api/workspaces');
    console.log('   - Test flashcard generation: /api/flashcards');
    console.log('   - Monitor error rates and logs\n');
    console.log('3. Investigate root cause');
    console.log('   - Review application logs for errors');
    console.log('   - Check database performance metrics');
    console.log('   - Analyze user-reported issues');
    console.log('   - Document findings before attempting migration again\n');
    console.log('4. Update _prisma_migrations table (if needed)');
    console.log('   - The migration record may still exist in _prisma_migrations');
    console.log('   - Consider removing it to allow re-applying the migration later');
    console.log('   - SQL: DELETE FROM "_prisma_migrations" WHERE migration_name = \'20260209000000_add_feature_usage_dates\';\n');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('\n❌ ROLLBACK FAILED\n');
    console.error('Error:', error);
    console.error('\n💡 Possible causes:');
    console.error('  - Database connection issue (check DATABASE_URL)');
    console.error('  - Insufficient permissions to alter table');
    console.error('  - Database is locked or in use');
    console.error('\n⚠️  CRITICAL: Manual database intervention may be required.\n');
    console.error('Contact database administrator immediately.\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Confirmation prompt (commented out for safety - uncomment to require confirmation)
/*
console.log('\n⚠️  EMERGENCY ROLLBACK CONFIRMATION\n');
console.log('This script will remove the following columns from the User table:');
console.log('  - lastFlashcardUsageDate');
console.log('  - lastQuizUsageDate');
console.log('  - lastMindmapUsageDate');
console.log('  - lastStudyDeckUsageDate\n');
console.log('Type "ROLLBACK" to confirm: ');

process.stdin.once('data', (data) => {
  const input = data.toString().trim();
  if (input === 'ROLLBACK') {
    rollbackMigration();
  } else {
    console.log('\n❌ Rollback cancelled.\n');
    process.exit(0);
  }
});
*/

// Run immediately (remove this and uncomment above for confirmation prompt)
rollbackMigration();
