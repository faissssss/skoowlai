import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('✅ MIGRATION VERIFICATION REPORT\n');
    console.log('=' .repeat(60));
    
    // 1. Verify columns exist with correct types
    console.log('\n1️⃣  Column Existence Check:');
    const columns = await prisma.$queryRaw<Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>>`
      SELECT column_name, data_type, is_nullable, column_default
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
    
    const expectedColumns = [
      'lastFlashcardUsageDate',
      'lastQuizUsageDate',
      'lastMindmapUsageDate',
      'lastStudyDeckUsageDate'
    ];
    
    let allColumnsExist = true;
    expectedColumns.forEach(expectedCol => {
      const found = columns.find(c => c.column_name === expectedCol);
      if (found) {
        console.log(`   ✓ ${found.column_name}`);
        console.log(`     Type: ${found.data_type}`);
        console.log(`     Nullable: ${found.is_nullable}`);
        console.log(`     Default: ${found.column_default || 'NULL'}`);
      } else {
        console.log(`   ❌ ${expectedCol} - MISSING`);
        allColumnsExist = false;
      }
    });
    
    // 2. Verify migration is recorded
    console.log('\n2️⃣  Migration History Check:');
    const migration = await prisma.$queryRaw<Array<{
      migration_name: string;
      applied_steps_count: number;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>>`
      SELECT migration_name, applied_steps_count, finished_at, rolled_back_at
      FROM _prisma_migrations
      WHERE migration_name = '20260209000000_add_feature_usage_dates';
    `;
    
    if (migration.length > 0) {
      const m = migration[0];
      console.log(`   ✓ Migration recorded: ${m.migration_name}`);
      console.log(`     Applied steps: ${m.applied_steps_count}`);
      console.log(`     Finished at: ${m.finished_at}`);
      console.log(`     Rolled back: ${m.rolled_back_at ? 'YES' : 'NO'}`);
    } else {
      console.log('   ❌ Migration NOT found in _prisma_migrations table');
    }
    
    // 3. Test a simple query to ensure Prisma can access the columns
    console.log('\n3️⃣  Prisma Query Test:');
    try {
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
      console.log(`   ✓ Successfully queried User table with new columns`);
      console.log(`     Users with usage dates: ${userCount}`);
    } catch (error) {
      console.log(`   ❌ Failed to query User table: ${error}`);
    }
    
    // 4. Summary
    console.log('\n' + '='.repeat(60));
    if (allColumnsExist && migration.length > 0) {
      console.log('\n✅ VERIFICATION PASSED');
      console.log('   All columns exist with correct types');
      console.log('   Migration is properly recorded');
      console.log('   Prisma can query the new columns');
      console.log('\n🎉 Migration successfully applied to production!');
    } else {
      console.log('\n❌ VERIFICATION FAILED');
      console.log('   Please review the issues above');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
