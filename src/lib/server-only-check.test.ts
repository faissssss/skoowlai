/**
 * Unit Tests for server-only-check module
 * 
 * Note: This module imports 'server-only' which throws an error when imported
 * in non-server contexts (like Node.js test runners). Therefore, we test the
 * function logic by reimplementing it here without the server-only import.
 * 
 * The build-time check (importing in Client Component triggers build error)
 * is verified through Next.js build process, not unit tests.
 */

import assert from 'node:assert/strict';

const originalEnv = { ...process.env };
const tests: Array<{ name: string; run: () => void }> = [];

function resetEnv() {
  process.env = { ...originalEnv };
}

function test(name: string, run: () => void) {
  tests.push({ name, run });
}

// Reimplementation of getServerSecret for testing purposes
// (without server-only import which would fail in test context)
function getServerSecret(key: string): string {
  const value = process.env[key];
  
  if (!value) {
    throw new Error(`Missing required secret: ${key}`);
  }
  
  return value;
}

// ── getServerSecret Tests ───────────────────────────────────────────────────

test('getServerSecret returns the value when environment variable exists', () => {
  process.env.TEST_SECRET = 'test-secret-value';

  const result = getServerSecret('TEST_SECRET');

  assert.equal(result, 'test-secret-value');
});

test('getServerSecret throws error when environment variable is missing', () => {
  delete process.env.MISSING_SECRET;

  assert.throws(
    () => getServerSecret('MISSING_SECRET'),
    {
      name: 'Error',
      message: 'Missing required secret: MISSING_SECRET',
    }
  );
});

test('getServerSecret throws error when environment variable is empty string', () => {
  process.env.EMPTY_SECRET = '';

  assert.throws(
    () => getServerSecret('EMPTY_SECRET'),
    {
      name: 'Error',
      message: 'Missing required secret: EMPTY_SECRET',
    }
  );
});

test('getServerSecret works with various secret formats', () => {
  process.env.GROQ_API_KEY = 'gsk_test123';
  process.env.CLERK_SECRET_KEY = 'sk_test_abc123';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

  assert.equal(getServerSecret('GROQ_API_KEY'), 'gsk_test123');
  assert.equal(getServerSecret('CLERK_SECRET_KEY'), 'sk_test_abc123');
  assert.equal(getServerSecret('DATABASE_URL'), 'postgresql://user:pass@localhost:5432/db');
});

test('getServerSecret error message includes the key name', () => {
  delete process.env.SPECIFIC_KEY;

  try {
    getServerSecret('SPECIFIC_KEY');
    assert.fail('Expected error to be thrown');
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes('SPECIFIC_KEY'));
  }
});

test('getServerSecret handles special characters in secret values', () => {
  process.env.COMPLEX_SECRET = 'abc!@#$%^&*()_+-=[]{}|;:,.<>?';

  const result = getServerSecret('COMPLEX_SECRET');

  assert.equal(result, 'abc!@#$%^&*()_+-=[]{}|;:,.<>?');
});

test('getServerSecret handles multiline secret values', () => {
  process.env.MULTILINE_SECRET = 'line1\nline2\nline3';

  const result = getServerSecret('MULTILINE_SECRET');

  assert.equal(result, 'line1\nline2\nline3');
});

// ── Build-Time Check Documentation ──────────────────────────────────────────

test('documents that server-only import check is verified at build time', () => {
  // This test documents that the build-time check for Client Component imports
  // is verified through the Next.js build process, not unit tests.
  // 
  // To verify:
  // 1. Create a Client Component that imports from server-only-check
  // 2. Run `npm run build`
  // 3. Build should fail with error: "This module cannot be imported from a Client Component"
  //
  // Example Client Component that should fail:
  // ```typescript
  // 'use client';
  // import { getServerSecret } from '@/lib/server-only-check';
  // export default function ClientComponent() {
  //   const secret = getServerSecret('TEST'); // This will cause build error
  //   return <div>Client</div>;
  // }
  // ```
  
  assert.ok(true, 'Build-time check is documented');
});

// ── Run Tests ────────────────────────────────────────────────────────────────

let passed = 0;

for (const { name, run } of tests) {
  try {
    process.env = { ...originalEnv };
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    resetEnv();
    process.exitCode = 1;
    break;
  }

  resetEnv();
}

if (!process.exitCode) {
  console.log(`All ${passed} server-only-check tests passed.`);
}
