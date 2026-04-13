import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  datetime_precision: number | null;
}

async function verifySchema() {
  try {
    console.log('🔍 DATABASE SCHEMA VERIFICATION\n');
    console.log('=' .repeat(60));
    
    // Expected columns from Prisma schema
    const expectedColumns = [
      'lastFlashcardUsageDate',
      'lastQuizUsageDate',
      'lastMindmapUsageDate',
      'lastStudyDeckUsageDate'
    ];
    
    console.log('\n📋 Checking for required columns in User table...\n');
    
    // Query database schema for the four columns
    const columns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        datetime_precision
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
    
    let hasErrors = false;
    const errors: string[] = [];
    
    // Check each expected column
    for (const expectedCol of expectedColumns) {
      const found = columns.find(c => c.column_name === expectedCol);
      
      if (!found) {
        console.log(`   ❌ ${expectedCol} - MISSING`);
        errors.push(`Column ${expectedCol} does not exist in User table`);
        hasErrors = true;
      } else {
        // Verify column type and nullable constraint
        const isTimestamp = found.data_type === 'timestamp without time zone';
        const isPrecision3 = found.datetime_precision === 3;
        const isNullable = found.is_nullable === 'YES';
        
        if (isTimestamp && isPrecision3 && isNullable) {
          console.log(`   ✓ ${found.column_name}`);
          console.log(`     Type: ${found.data_type} (precision: ${found.datetime_precision})`);
          console.log(`     Nullable: ${found.is_nullable}`);
        } else {
          console.log(`   ⚠️  ${found.column_name} - TYPE MISMATCH`);
          console.log(`     Expected: TIMESTAMP(3), nullable`);
          console.log(`     Actual: ${found.data_type} (precision: ${found.datetime_precision}), nullable: ${found.is_nullable}`);
          
          if (!isTimestamp) {
            errors.push(`Column ${expectedCol} has incorrect type: ${found.data_type} (expected: timestamp without time zone)`);
          }
          if (!isPrecision3) {
            errors.push(`Column ${expectedCol} has incorrect precision: ${found.datetime_precision} (expected: 3)`);
          }
          if (!isNullable) {
            errors.push(`Column ${expectedCol} is not nullable (expected: YES)`);
          }
          hasErrors = true;
        }
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    
    if (hasErrors) {
      console.log('\n❌ SCHEMA VERIFICATION FAILED\n');
      console.log('Errors found:');
      errors.forEach(error => console.log(`  - ${error}`));
      console.log('\n💡 Action required:');
      console.log('  Run: npx prisma migrate deploy');
      console.log('  This will apply pending migrations to sync the database schema.\n');
      process.exit(1);
    } else {
      console.log('\n✅ SCHEMA VERIFICATION PASSED\n');
      console.log('All required columns exist with correct types:');
      expectedColumns.forEach(col => console.log(`  ✓ ${col}`));
      console.log('\n🎉 Database schema matches Prisma schema!\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error during schema verification:', error);
    console.error('\n💡 This may indicate a database connection issue.');
    console.error('   Check your DATABASE_URL environment variable.\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema();
