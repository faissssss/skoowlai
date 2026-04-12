import assert from 'node:assert/strict';

import fc from 'fast-check';

import { sanitizeLogData } from './router';

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>) {
  tests.push({ name, run });
}

test('Property 33: API keys are redacted from logs', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.base64String({ minLength: 32, maxLength: 64 }),
      fc.string({ minLength: 10, maxLength: 50 }),
      async (apiKey: string, context: string) => {
        const logMessage = `${context} API_KEY=${apiKey} ${context}`;
        const sanitized = sanitizeLogData(logMessage);
        
        // API key should be redacted
        assert.equal(sanitized.includes(apiKey), false, `API key ${apiKey} was not redacted`);
        assert.equal(sanitized.includes('[REDACTED_API_KEY]'), true);
      },
    ),
    { numRuns: 50 },
  );
});

test('redacts OpenAI-style API keys', () => {
  const log = 'Using API key sk-1234567890abcdefghij for request';
  const sanitized = sanitizeLogData(log);
  
  assert.equal(sanitized.includes('sk-1234567890abcdefghij'), false);
  assert.equal(sanitized.includes('[REDACTED_API_KEY]'), true);
});

test('redacts Google API keys', () => {
  const log = 'Google API key: AIzaSyD1234567890abcdefghijklmnopqrs';
  const sanitized = sanitizeLogData(log);
  
  assert.equal(sanitized.includes('AIzaSyD1234567890abcdefghijklmnopqrs'), false);
  assert.equal(sanitized.includes('[REDACTED_API_KEY]'), true);
});

test('redacts email addresses', () => {
  const log = 'User email: user@example.com sent request';
  const sanitized = sanitizeLogData(log);
  
  assert.equal(sanitized.includes('user@example.com'), false);
  assert.equal(sanitized.includes('[REDACTED_EMAIL]'), true);
});

test('redacts phone numbers', () => {
  const log = 'Contact: 555-123-4567 or +1-555-123-4567';
  const sanitized = sanitizeLogData(log);
  
  assert.equal(sanitized.includes('555-123-4567'), false);
  assert.equal(sanitized.includes('[REDACTED_PHONE]'), true);
});

test('redacts credit card numbers', () => {
  const log = 'Payment with card 4532-1234-5678-9010';
  const sanitized = sanitizeLogData(log);
  
  assert.equal(sanitized.includes('4532-1234-5678-9010'), false);
  assert.equal(sanitized.includes('[REDACTED_CC]'), true);
});

test('redacts SSN', () => {
  const log = 'SSN: 123-45-6789 for verification';
  const sanitized = sanitizeLogData(log);
  
  assert.equal(sanitized.includes('123-45-6789'), false);
  assert.equal(sanitized.includes('[REDACTED_SSN]'), true);
});

test('redacts bearer tokens', () => {
  const log = 'Authorization: Bearer abc123def456ghi789';
  const sanitized = sanitizeLogData(log);
  
  assert.equal(sanitized.includes('abc123def456ghi789'), false);
  assert.equal(sanitized.includes('Bearer [REDACTED_TOKEN]'), true);
});

test('preserves non-sensitive data', () => {
  const log = 'Request completed in 150ms with status 200';
  const sanitized = sanitizeLogData(log);
  
  assert.equal(sanitized, log);
});

test('handles multiple sensitive items in one log', () => {
  const log = 'User user@example.com with API key sk-abc123def456ghi789jkl012 called from 555-123-4567';
  const sanitized = sanitizeLogData(log);
  
  assert.equal(sanitized.includes('user@example.com'), false);
  assert.equal(sanitized.includes('sk-abc123def456ghi789jkl012'), false);
  assert.equal(sanitized.includes('555-123-4567'), false);
  assert.equal(sanitized.includes('[REDACTED_EMAIL]'), true);
  assert.equal(sanitized.includes('[REDACTED_API_KEY]'), true);
  assert.equal(sanitized.includes('[REDACTED_PHONE]'), true);
});

let passed = 0;

async function main() {
  for (const { name, run } of tests) {
    try {
      await run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }

  if (!process.exitCode) {
    console.log(`All ${passed} sanitization tests passed.`);
  }
}

void main();
