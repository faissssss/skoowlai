import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchema() {
  try {
    console.log('🔍 Checking current database schema...\n');
    
    // Query to check if the columns exist
    const result = await prisma.$queryRaw<Array<{
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
    
    console.log(`Found ${result.length} of 4 expected columns:\n`);
    
    if (result.length === 0) {
      console.log('❌ No columns found - migration needs to be applied');
    } else {
      result.forEach(col => {
        console.log(`✓ ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      if (result.length < 4) {
        console.log(`\n⚠️  Missing ${4 - result.length} columns - migration needs to be applied`);
      } else {
        console.log('\n✅ All columns exist - migration already applied');
      }
    }
    
    // Check migration status
    console.log('\n📋 Checking migration history...\n');
    const migrations = await prisma.$queryRaw<Array<{
      migration_name: string;
      applied_steps_count: number;
      finished_at: Date | null;
    }>>`
      SELECT migration_name, applied_steps_count, finished_at
      FROM _prisma_migrations
      WHERE migration_name = '20260209000000_add_feature_usage_dates'
      ORDER BY finished_at DESC;
    `;
    
    if (migrations.length === 0) {
      console.log('❌ Migration 20260209000000_add_feature_usage_dates NOT found in migration history');
    } else {
      migrations.forEach(m => {
        console.log(`✓ Migration: ${m.migration_name}`);
        console.log(`  Applied steps: ${m.applied_steps_count}`);
        console.log(`  Finished at: ${m.finished_at}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
