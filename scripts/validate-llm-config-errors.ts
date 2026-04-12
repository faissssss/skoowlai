/**
 * Validation script for LLM Provider Configuration Error Handling
 * 
 * This script validates that the ProviderConfig module correctly:
 * - Detects missing environment variables
 * - Detects invalid environment variables
 * - Provides descriptive error messages
 */

import { ProviderConfig, ConfigurationError } from '../src/lib/llm/config';

console.log('🔍 Validating LLM Provider Configuration Error Handling...\n');

let testsPassed = 0;
let testsFailed = 0;

// Helper function to run a test
function runTest(testName: string, testFn: () => void) {
  try {
    console.log(`Test: ${testName}`);
    testFn();
    console.log('✅ PASSED\n');
    testsPassed++;
  } catch (error) {
    console.log('❌ FAILED');
    console.error(error);
    console.log('');
    testsFailed++;
  }
}

// Test 1: Missing GROQ_API_KEY
runTest('Missing GROQ_API_KEY should throw ConfigurationError', () => {
  const originalValue = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  
  try {
    ProviderConfig.load();
    throw new Error('Expected ConfigurationError to be thrown');
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw new Error('Expected ConfigurationError');
    }
    if (!error.message.includes('GROQ_API_KEY')) {
      throw new Error('Error message should mention GROQ_API_KEY');
    }
    if (!error.missingKeys?.includes('GROQ_API_KEY')) {
      throw new Error('missingKeys should include GROQ_API_KEY');
    }
  } finally {
    if (originalValue) process.env.GROQ_API_KEY = originalValue;
  }
});

// Test 2: Missing GOOGLE_GENERATIVE_AI_API_KEY
runTest('Missing GOOGLE_GENERATIVE_AI_API_KEY should throw ConfigurationError', () => {
  const originalValue = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  try {
    ProviderConfig.load();
    throw new Error('Expected ConfigurationError to be thrown');
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw new Error('Expected ConfigurationError');
    }
    if (!error.message.includes('GOOGLE_GENERATIVE_AI_API_KEY')) {
      throw new Error('Error message should mention GOOGLE_GENERATIVE_AI_API_KEY');
    }
    if (!error.missingKeys?.includes('GOOGLE_GENERATIVE_AI_API_KEY')) {
      throw new Error('missingKeys should include GOOGLE_GENERATIVE_AI_API_KEY');
    }
  } finally {
    if (originalValue) process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalValue;
  }
});

// Test 3: Missing PRIMARY_LLM_PROVIDER
runTest('Missing PRIMARY_LLM_PROVIDER should throw ConfigurationError', () => {
  const originalValue = process.env.PRIMARY_LLM_PROVIDER;
  delete process.env.PRIMARY_LLM_PROVIDER;
  
  try {
    ProviderConfig.load();
    throw new Error('Expected ConfigurationError to be thrown');
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw new Error('Expected ConfigurationError');
    }
    if (!error.message.includes('PRIMARY_LLM_PROVIDER')) {
      throw new Error('Error message should mention PRIMARY_LLM_PROVIDER');
    }
    if (!error.missingKeys?.includes('PRIMARY_LLM_PROVIDER')) {
      throw new Error('missingKeys should include PRIMARY_LLM_PROVIDER');
    }
  } finally {
    if (originalValue) process.env.PRIMARY_LLM_PROVIDER = originalValue;
  }
});

// Test 4: Invalid PRIMARY_LLM_PROVIDER
runTest('Invalid PRIMARY_LLM_PROVIDER should throw ConfigurationError', () => {
  const originalValue = process.env.PRIMARY_LLM_PROVIDER;
  process.env.PRIMARY_LLM_PROVIDER = 'invalid-provider';
  
  try {
    ProviderConfig.load();
    throw new Error('Expected ConfigurationError to be thrown');
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw new Error('Expected ConfigurationError');
    }
    if (!error.message.includes('PRIMARY_LLM_PROVIDER')) {
      throw new Error('Error message should mention PRIMARY_LLM_PROVIDER');
    }
    if (!error.invalidKeys?.some(k => k.includes('PRIMARY_LLM_PROVIDER'))) {
      throw new Error('invalidKeys should include PRIMARY_LLM_PROVIDER');
    }
  } finally {
    if (originalValue) process.env.PRIMARY_LLM_PROVIDER = originalValue;
  }
});

// Test 5: Invalid FALLBACK_LLM_PROVIDER
runTest('Invalid FALLBACK_LLM_PROVIDER should throw ConfigurationError', () => {
  const originalValue = process.env.FALLBACK_LLM_PROVIDER;
  process.env.FALLBACK_LLM_PROVIDER = 'invalid-provider';
  
  try {
    ProviderConfig.load();
    throw new Error('Expected ConfigurationError to be thrown');
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw new Error('Expected ConfigurationError');
    }
    if (!error.message.includes('FALLBACK_LLM_PROVIDER')) {
      throw new Error('Error message should mention FALLBACK_LLM_PROVIDER');
    }
    if (!error.invalidKeys?.some(k => k.includes('FALLBACK_LLM_PROVIDER'))) {
      throw new Error('invalidKeys should include FALLBACK_LLM_PROVIDER');
    }
  } finally {
    if (originalValue) process.env.FALLBACK_LLM_PROVIDER = originalValue;
  }
});

// Test 6: Invalid LLM_MODEL_MAPPING (malformed JSON)
runTest('Invalid LLM_MODEL_MAPPING JSON should throw ConfigurationError', () => {
  const originalValue = process.env.LLM_MODEL_MAPPING;
  process.env.LLM_MODEL_MAPPING = 'invalid-json{';
  
  try {
    ProviderConfig.load();
    throw new Error('Expected ConfigurationError to be thrown');
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw new Error('Expected ConfigurationError');
    }
    if (!error.message.includes('LLM_MODEL_MAPPING')) {
      throw new Error('Error message should mention LLM_MODEL_MAPPING');
    }
  } finally {
    if (originalValue) {
      process.env.LLM_MODEL_MAPPING = originalValue;
    } else {
      delete process.env.LLM_MODEL_MAPPING;
    }
  }
});

// Test 7: Invalid LLM_MODEL_MAPPING (invalid structure)
runTest('Invalid LLM_MODEL_MAPPING structure should throw ConfigurationError', () => {
  const originalValue = process.env.LLM_MODEL_MAPPING;
  process.env.LLM_MODEL_MAPPING = JSON.stringify({
    generate: { provider: 'invalid-provider', model: 'test', priority: 'high' }
  });
  
  try {
    ProviderConfig.load();
    throw new Error('Expected ConfigurationError to be thrown');
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw new Error('Expected ConfigurationError');
    }
    if (!error.message.includes('LLM_MODEL_MAPPING')) {
      throw new Error('Error message should mention LLM_MODEL_MAPPING');
    }
  } finally {
    if (originalValue) {
      process.env.LLM_MODEL_MAPPING = originalValue;
    } else {
      delete process.env.LLM_MODEL_MAPPING;
    }
  }
});

// Test 8: Error message includes remediation steps
runTest('Error message should include remediation steps', () => {
  const originalValue = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  
  try {
    ProviderConfig.load();
    throw new Error('Expected ConfigurationError to be thrown');
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw new Error('Expected ConfigurationError');
    }
    if (!error.message.includes('Remediation steps')) {
      throw new Error('Error message should include remediation steps');
    }
  } finally {
    if (originalValue) process.env.GROQ_API_KEY = originalValue;
  }
});

// Test 9: Empty string API key should be treated as missing
runTest('Empty string API key should be treated as missing', () => {
  const originalValue = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = '   ';
  
  try {
    ProviderConfig.load();
    throw new Error('Expected ConfigurationError to be thrown');
  } catch (error) {
    if (!(error instanceof ConfigurationError)) {
      throw new Error('Expected ConfigurationError');
    }
    if (!error.missingKeys?.includes('GROQ_API_KEY')) {
      throw new Error('missingKeys should include GROQ_API_KEY for empty string');
    }
  } finally {
    if (originalValue) process.env.GROQ_API_KEY = originalValue;
  }
});

// Print summary
console.log('═══════════════════════════════════════════════════════');
console.log('Summary:');
console.log(`  ✅ Tests Passed: ${testsPassed}`);
console.log(`  ❌ Tests Failed: ${testsFailed}`);
console.log('═══════════════════════════════════════════════════════');

if (testsFailed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n🎉 All error handling tests passed!');
  process.exit(0);
}
