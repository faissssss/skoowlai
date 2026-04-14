/**
 * Bug Condition Exploration Test for Production Database Error
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * This test demonstrates the production database error bug by:
 * 1. Simulating production environment with file upload to `/api/generate-from-blob`
 * 2. Monitoring stderr for DEP0005 Buffer deprecation warnings from pdf-parse/officeparser
 * 3. Mocking Prisma client initialization delay to trigger cold start scenario
 * 4. Attempting `prisma.llmRequest.upsert()` operation and observing failure
 * 5. Verifying "[LLM Service] Falling back to in-memory cost storage" appears in logs
 * 6. Confirming cost tracking data is NOT persisted to database after function terminates
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { db } from '@/lib/db';
import { PrismaClient } from '@prisma/client';

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

/**
 * Helper to capture stderr output from a Node.js process
 * Used to detect DEP0005 Buffer deprecation warnings
 */
async function captureDeprecationWarnings(): Promise<{ hasWarnings: boolean; warnings: string[] }> {
  return new Promise((resolve) => {
    const warnings: string[] = [];
    
    // Spawn a Node.js process that loads pdf-parse (which uses deprecated Buffer())
    const child = spawn('node', ['-e', `
      const pdfParse = require('pdf-parse');
      const buffer = Buffer.from('test');
      console.log('done');
    `], {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('DEP0005') || output.includes('DeprecationWarning')) {
        warnings.push(output);
      }
    });

    child.on('close', () => {
      resolve({
        hasWarnings: warnings.length > 0,
        warnings
      });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve({ hasWarnings: false, warnings: [] });
    }, 5000);
  });
}

/**
 * Helper to simulate Prisma client initialization delay (cold start)
 * Returns a mock that fails on upsert operations
 */
function createDelayedPrismaClient(): any {
  return {
    llmRequest: {
      upsert: async () => {
        // Simulate cold start delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Simulate Prisma client not ready error
        const error: any = new Error("Invalid `prisma.llmRequest.upsert()` invocation");
        error.code = 'P1001';
        throw error;
      },
      findMany: async () => []
    },
    $queryRaw: async () => []
  };
}

/**
 * Helper to capture console.warn output
 * Used to detect fallback warning messages
 */
function captureConsoleWarn(): { restore: () => void; warnings: string[] } {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  
  console.warn = (...args: any[]) => {
    warnings.push(args.join(' '));
    originalWarn(...args);
  };
  
  return {
    restore: () => { console.warn = originalWarn; },
    warnings
  };
}

test('Bug Condition 1.1: DEP0005 Buffer deprecation warnings in production', async () => {
  /**
   * **Expected Outcome on UNFIXED code**: Test FAILS (hasWarnings === true)
   * This confirms that pdf-parse/officeparser emit DEP0005 warnings
   * 
   * **Expected Outcome on FIXED code**: Test PASSES (hasWarnings === false)
   * The --no-deprecation flag suppresses warnings
   */
  
  const { hasWarnings, warnings } = await captureDeprecationWarnings();
  
  // Document counterexamples found
  if (hasWarnings) {
    console.log('\n=== COUNTEREXAMPLE: Buffer Deprecation Warnings ===');
    console.log('DEP0005 warnings detected:');
    warnings.forEach(w => console.log('  ', w.trim()));
    console.log('===================================================\n');
  }
  
  // On unfixed code, this assertion will FAIL (proving bug exists)
  // On fixed code, this assertion will PASS (proving fix works)
  assert.equal(
    hasWarnings,
    false,
    'Expected no DEP0005 Buffer deprecation warnings in production, but warnings were emitted'
  );
});

test('Bug Condition 1.2 & 1.3: Prisma upsert fails and triggers fallback', async () => {
  /**
   * **Expected Outcome on UNFIXED code**: Test FAILS
   * - prismaUpsertFails === true (database operation fails)
   * - fallbackTriggered === true (fallback warning appears)
   * 
   * **Expected Outcome on FIXED code**: Test PASSES
   * - prismaUpsertFails === false (database operation succeeds with retry)
   * - fallbackTriggered === false (no fallback needed)
   */
  
  const { PrismaCostStorage, ResilientCostStorage, InMemoryCostStorage } = await import('./costTracker');
  const delayedClient = createDelayedPrismaClient();
  
  // Temporarily replace db with delayed client
  const originalDb = (global as any).db;
  (global as any).db = delayedClient;
  
  const { restore, warnings } = captureConsoleWarn();
  
  try {
    // Create storage instances
    const primaryStorage = new (PrismaCostStorage as any)();
    const fallbackStorage = new InMemoryCostStorage();
    const resilientStorage = new (ResilientCostStorage as any)(primaryStorage, fallbackStorage);
    
    // Attempt to insert cost entry (will fail on unfixed code)
    const testEntry = {
      timestamp: new Date(),
      provider: 'groq' as const,
      model: 'llama-3.3-70b-versatile',
      feature: 'generate',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      latencyMs: 500,
      success: true,
      fallbackUsed: false,
      requestId: 'test-request-id-' + Date.now(),
    };
    
    await resilientStorage.insert(testEntry);
    
    // Check if fallback was triggered
    const fallbackTriggered = warnings.some(w => 
      w.includes('[LLM Service] Falling back to in-memory cost storage')
    );
    
    // Document counterexamples
    if (fallbackTriggered) {
      console.log('\n=== COUNTEREXAMPLE: Prisma Upsert Failure ===');
      console.log('Fallback warning detected:');
      warnings.forEach(w => {
        if (w.includes('[LLM Service]')) {
          console.log('  ', w);
        }
      });
      console.log('=============================================\n');
    }
    
    // On unfixed code, this assertion will FAIL (proving bug exists)
    // On fixed code, this assertion will PASS (proving fix works)
    assert.equal(
      fallbackTriggered,
      false,
      'Expected no fallback to in-memory storage, but fallback was triggered due to Prisma upsert failure'
    );
    
  } finally {
    restore();
    (global as any).db = originalDb;
  }
});

test('Bug Condition 1.4: Cost data NOT persisted after serverless function terminates', async () => {
  /**
   * **Expected Outcome on UNFIXED code**: Test FAILS (costDataPersisted === false)
   * Cost data is stored in-memory and lost after function terminates
   * 
   * **Expected Outcome on FIXED code**: Test PASSES (costDataPersisted === true)
   * Cost data is successfully persisted to database
   */
  
  const testRequestId = 'persistence-test-' + Date.now();
  
  // Clean up any existing test data
  try {
    await db.llmRequest.deleteMany({
      where: { requestId: testRequestId }
    });
  } catch (e) {
    // Ignore cleanup errors
  }
  
  // Simulate cold start scenario with delayed Prisma client
  const delayedClient = createDelayedPrismaClient();
  const originalDb = (global as any).db;
  (global as any).db = delayedClient;
  
  const { restore } = captureConsoleWarn();
  
  try {
    const { PrismaCostStorage, ResilientCostStorage, InMemoryCostStorage } = await import('./costTracker');
    
    const primaryStorage = new (PrismaCostStorage as any)();
    const fallbackStorage = new InMemoryCostStorage();
    const resilientStorage = new (ResilientCostStorage as any)(primaryStorage, fallbackStorage);
    
    // Attempt to insert cost entry
    const testEntry = {
      timestamp: new Date(),
      provider: 'groq' as const,
      model: 'llama-3.3-70b-versatile',
      feature: 'generate',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      latencyMs: 500,
      success: true,
      fallbackUsed: false,
      requestId: testRequestId,
    };
    
    await resilientStorage.insert(testEntry);
    
  } finally {
    restore();
    (global as any).db = originalDb;
  }
  
  // Simulate function termination and check if data persisted
  // Restore real db and query for the entry
  const persistedEntry = await db.llmRequest.findFirst({
    where: { requestId: testRequestId }
  });
  
  const costDataPersisted = persistedEntry !== null;
  
  // Document counterexample
  if (!costDataPersisted) {
    console.log('\n=== COUNTEREXAMPLE: Cost Data Not Persisted ===');
    console.log('Request ID:', testRequestId);
    console.log('Database query result:', persistedEntry);
    console.log('Cost data was stored in-memory and lost after function termination');
    console.log('===============================================\n');
  }
  
  // On unfixed code, this assertion will FAIL (proving bug exists)
  // On fixed code, this assertion will PASS (proving fix works)
  assert.equal(
    costDataPersisted,
    true,
    'Expected cost data to be persisted to database, but data was lost after function termination'
  );
  
  // Cleanup
  if (persistedEntry) {
    await db.llmRequest.deleteMany({
      where: { requestId: testRequestId }
    });
  }
});

test('Bug Condition 1.5: Endpoint returns 200 despite database errors', async () => {
  /**
   * **Expected Outcome on UNFIXED code**: Test FAILS (returns 200)
   * Endpoint silently succeeds despite database configuration errors
   * 
   * **Expected Outcome on FIXED code**: Test PASSES (returns 500)
   * Endpoint returns appropriate error status for critical database failures
   */
  
  // This test would require mocking the full API route
  // For now, we verify the behavior at the service level
  
  const { restore, warnings } = captureConsoleWarn();
  
  try {
    // Simulate database configuration error
    const originalEnv = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    
    const { PrismaCostStorage } = await import('./costTracker');
    const storage = new (PrismaCostStorage as any)();
    
    const testEntry = {
      timestamp: new Date(),
      provider: 'groq' as const,
      model: 'llama-3.3-70b-versatile',
      feature: 'generate',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      latencyMs: 500,
      success: true,
      fallbackUsed: false,
      requestId: 'config-error-test-' + Date.now(),
    };
    
    let errorThrown = false;
    let errorMessage = '';
    
    try {
      await storage.insert(testEntry);
    } catch (error: any) {
      errorThrown = true;
      errorMessage = error.message;
    }
    
    // Restore environment
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    }
    
    // Document counterexample
    if (!errorThrown) {
      console.log('\n=== COUNTEREXAMPLE: Silent Database Error ===');
      console.log('Database configuration error did not throw');
      console.log('Warnings:', warnings);
      console.log('This would result in endpoint returning 200 despite critical error');
      console.log('=============================================\n');
    }
    
    // On unfixed code, this assertion will FAIL (proving bug exists)
    // On fixed code, this assertion will PASS (proving fix works)
    assert.equal(
      errorThrown,
      true,
      'Expected database configuration error to throw, but operation silently failed'
    );
    
    if (errorThrown) {
      assert.ok(
        errorMessage.includes('Database configuration error') || 
        errorMessage.includes('DATABASE_URL'),
        'Expected configuration error message, got: ' + errorMessage
      );
    }
    
  } finally {
    restore();
  }
});

let passed = 0;

async function main() {
  console.log('\n========================================');
  console.log('Bug Condition Exploration Test');
  console.log('========================================');
  console.log('CRITICAL: These tests MUST FAIL on unfixed code');
  console.log('Failures confirm the bug exists and provide counterexamples');
  console.log('========================================\n');
  
  for (const { name, run } of tests) {
    try {
      await run();
      passed += 1;
      console.log(`✓ PASS ${name}`);
    } catch (error) {
      console.error(`✗ FAIL ${name}`);
      console.error(error);
      console.log('');
    }
  }
  
  console.log('\n========================================');
  console.log(`Results: ${passed}/${tests.length} tests passed`);
  console.log('========================================');
  
  if (passed < tests.length) {
    console.log('\n⚠️  EXPECTED OUTCOME: Tests failed on unfixed code');
    console.log('This confirms the bug exists. Review counterexamples above.');
    console.log('After implementing the fix, these tests should pass.');
  } else {
    console.log('\n✓ All tests passed - bug is fixed!');
  }
  
  console.log('========================================\n');
}

void main();
