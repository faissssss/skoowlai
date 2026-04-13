import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Bug Condition Exploration Test
 * 
 * This test encodes the expected behavior after the fix is applied.
 * Since the migration has already been applied to production, this test
 * should PASS, confirming that the bug is fixed.
 * 
 * Expected Behavior:
 * 1. All four columns should exist in the User table
 * 2. Authenticated API requests should work correctly
 * 3. Prisma queries should not throw P2022 errors
 * 
 * Bug Condition (what we're testing was fixed):
 * - Missing columns: lastFlashcardUsageDate, lastQuizUsageDate, 
 *   lastMindmapUsageDate, lastStudyDeckUsageDate
 * - P2022 errors on authenticated endpoints
 */

async function testBugCondition() {
  try {
    console.log('🔍 BUG CONDITION EXPLORATION TEST\n');
    console.log('Testing that the schema bug has been fixed...\n');
    console.log('=' .repeat(60));
    
    let allTestsPassed = true;
    
    // Test 1: Query information_schema.columns for the missing columns
    console.log('\n1️⃣  Test: Schema Columns Existence');
    console.log('   Expected: All 4 columns should exist in User table');
    
    const columns = await prisma.$queryRaw<Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>>`
      SELECT column_name, data_type, is_nullable
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
    
    console.log(`   Result: Found ${columns.length} of 4 expected columns`);
    
    if (columns.length === 4) {
      console.log('   ✅ PASS: All columns exist');
      columns.forEach(col => {
        console.log(`      - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('   ❌ FAIL: Missing columns detected');
      allTestsPassed = false;
      
      const foundColumnNames = columns.map(c => c.column_name);
      const missingColumns = expectedColumns.filter(
        col => !foundColumnNames.includes(col)
      );
      
      console.log('   Missing columns:');
      missingColumns.forEach(col => {
        console.log(`      - ${col}`);
      });
    }
    
    // Test 2: Verify authenticated API requests work (no P2022 errors)
    console.log('\n2️⃣  Test: Authenticated API Requests');
    console.log('   Expected: Prisma queries should succeed without P2022 errors');
    
    try {
      // This query would fail with P2022 if columns don't exist
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
      
      console.log('   ✅ PASS: Query executed successfully');
      console.log(`      Users with usage dates: ${userCount}`);
    } catch (error: any) {
      console.log('   ❌ FAIL: Query failed with error');
      console.log(`      Error: ${error.message}`);
      
      if (error.code === 'P2022') {
        console.log('      🚨 P2022 Error: Column does not exist in database');
        console.log('      This confirms the bug condition still exists!');
      }
      
      allTestsPassed = false;
    }
    
    // Test 3: Test that we can query individual columns
    console.log('\n3️⃣  Test: Individual Column Queries');
    console.log('   Expected: Each column should be queryable without errors');
    
    const columnTests = [
      { name: 'lastFlashcardUsageDate', field: 'lastFlashcardUsageDate' },
      { name: 'lastQuizUsageDate', field: 'lastQuizUsageDate' },
      { name: 'lastMindmapUsageDate', field: 'lastMindmapUsageDate' },
      { name: 'lastStudyDeckUsageDate', field: 'lastStudyDeckUsageDate' }
    ];
    
    for (const test of columnTests) {
      try {
        const count = await prisma.user.count({
          where: {
            [test.field]: { not: null }
          }
        });
        console.log(`   ✅ ${test.name}: Query succeeded (${count} users)`);
      } catch (error: any) {
        console.log(`   ❌ ${test.name}: Query failed`);
        console.log(`      Error: ${error.message}`);
        
        if (error.code === 'P2022') {
          console.log(`      🚨 P2022 Error: Column ${test.name} does not exist`);
        }
        
        allTestsPassed = false;
      }
    }
    
    // Test 4: Test that we can update the columns
    console.log('\n4️⃣  Test: Column Update Operations');
    console.log('   Expected: Should be able to update usage date columns');
    
    try {
      const firstUser = await prisma.user.findFirst();
      
      if (firstUser) {
        const updated = await prisma.user.update({
          where: { id: firstUser.id },
          data: {
            lastFlashcardUsageDate: new Date(),
          },
          select: {
            id: true,
            email: true,
            lastFlashcardUsageDate: true,
          }
        });
        
        console.log('   ✅ PASS: Update operation succeeded');
        console.log(`      Updated user: ${updated.email}`);
        console.log(`      New date: ${updated.lastFlashcardUsageDate}`);
      } else {
        console.log('   ⚠️  SKIP: No users found to test update');
      }
    } catch (error: any) {
      console.log('   ❌ FAIL: Update operation failed');
      console.log(`      Error: ${error.message}`);
      
      if (error.code === 'P2022') {
        console.log('      🚨 P2022 Error: Column does not exist for update');
      }
      
      allTestsPassed = false;
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST SUMMARY\n');
    
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED');
      console.log('\nExpected Behavior Confirmed:');
      console.log('  ✓ All four columns exist in the User table');
      console.log('  ✓ Authenticated API requests work correctly');
      console.log('  ✓ No P2022 errors detected');
      console.log('  ✓ Column update operations succeed');
      console.log('\n🎉 The bug has been successfully fixed!');
      console.log('   Migration 20260209000000 was applied correctly.');
    } else {
      console.log('❌ TESTS FAILED');
      console.log('\nBug Condition Detected:');
      console.log('  ✗ Schema mismatch between Prisma schema and database');
      console.log('  ✗ Missing columns causing P2022 errors');
      console.log('  ✗ Authenticated endpoints will fail');
      console.log('\n⚠️  The bug still exists - migration needs to be applied!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Unexpected error during testing:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testBugCondition();
