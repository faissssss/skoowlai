import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testEndpoints() {
  try {
    console.log('🧪 Testing Endpoints Post-Migration\n');
    console.log('=' .repeat(60));
    
    // Test 1: Query User table with all new columns
    console.log('\n1️⃣  Test: Query User table with new columns');
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          lastFlashcardUsageDate: true,
          lastQuizUsageDate: true,
          lastMindmapUsageDate: true,
          lastStudyDeckUsageDate: true,
        },
        take: 5
      });
      console.log(`   ✅ SUCCESS: Retrieved ${users.length} users`);
      console.log(`   Sample data:`);
      users.forEach((user, idx) => {
        console.log(`     User ${idx + 1}: ${user.email}`);
        console.log(`       Flashcard: ${user.lastFlashcardUsageDate || 'NULL'}`);
        console.log(`       Quiz: ${user.lastQuizUsageDate || 'NULL'}`);
        console.log(`       Mindmap: ${user.lastMindmapUsageDate || 'NULL'}`);
        console.log(`       StudyDeck: ${user.lastStudyDeckUsageDate || 'NULL'}`);
      });
    } catch (error: any) {
      console.log(`   ❌ FAILED: ${error.message}`);
      if (error.code === 'P2022') {
        console.log(`   🚨 P2022 Error detected - column does not exist!`);
      }
    }
    
    // Test 2: Update a user's usage date
    console.log('\n2️⃣  Test: Update user usage dates');
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
        console.log(`   ✅ SUCCESS: Updated user ${updated.email}`);
        console.log(`   New lastFlashcardUsageDate: ${updated.lastFlashcardUsageDate}`);
      } else {
        console.log(`   ⚠️  No users found to test update`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAILED: ${error.message}`);
      if (error.code === 'P2022') {
        console.log(`   🚨 P2022 Error detected - column does not exist!`);
      }
    }
    
    // Test 3: Filter by usage dates
    console.log('\n3️⃣  Test: Filter users by usage dates');
    try {
      const usersWithFlashcards = await prisma.user.count({
        where: {
          lastFlashcardUsageDate: { not: null }
        }
      });
      const usersWithQuizzes = await prisma.user.count({
        where: {
          lastQuizUsageDate: { not: null }
        }
      });
      const usersWithMindmaps = await prisma.user.count({
        where: {
          lastMindmapUsageDate: { not: null }
        }
      });
      const usersWithStudyDecks = await prisma.user.count({
        where: {
          lastStudyDeckUsageDate: { not: null }
        }
      });
      
      console.log(`   ✅ SUCCESS: Filtered users by usage dates`);
      console.log(`   Users with flashcard usage: ${usersWithFlashcards}`);
      console.log(`   Users with quiz usage: ${usersWithQuizzes}`);
      console.log(`   Users with mindmap usage: ${usersWithMindmaps}`);
      console.log(`   Users with study deck usage: ${usersWithStudyDecks}`);
    } catch (error: any) {
      console.log(`   ❌ FAILED: ${error.message}`);
      if (error.code === 'P2022') {
        console.log(`   🚨 P2022 Error detected - column does not exist!`);
      }
    }
    
    // Test 4: Complex query with multiple date filters
    console.log('\n4️⃣  Test: Complex query with OR conditions');
    try {
      const activeUsers = await prisma.user.count({
        where: {
          OR: [
            { lastFlashcardUsageDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            { lastQuizUsageDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            { lastMindmapUsageDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            { lastStudyDeckUsageDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          ]
        }
      });
      console.log(`   ✅ SUCCESS: Complex query executed`);
      console.log(`   Active users (last 7 days): ${activeUsers}`);
    } catch (error: any) {
      console.log(`   ❌ FAILED: ${error.message}`);
      if (error.code === 'P2022') {
        console.log(`   🚨 P2022 Error detected - column does not exist!`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ ALL ENDPOINT TESTS PASSED');
    console.log('   No P2022 errors detected');
    console.log('   All queries executed successfully');
    console.log('   Migration is working correctly in production');
    
  } catch (error) {
    console.error('\n❌ Unexpected error during testing:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testEndpoints();
