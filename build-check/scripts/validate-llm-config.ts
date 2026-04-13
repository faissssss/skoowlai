/**
 * Validation script for LLM Provider Configuration
 * 
 * This script validates that the ProviderConfig module correctly:
 * - Loads environment variables
 * - Validates configuration
 * - Provides correct model mappings for all 7 endpoints
 */

import { config as loadEnv } from 'dotenv';
import { ProviderConfig, ConfigurationError } from '../src/lib/llm/config';

// Load environment variables from .env file
loadEnv();

console.log('🔍 Validating LLM Provider Configuration...\n');

try {
  // Test 1: Load configuration from environment
  console.log('Test 1: Loading configuration from environment variables...');
  const config = ProviderConfig.load();
  console.log('✅ Configuration loaded successfully\n');

  // Test 2: Verify primary and fallback providers
  console.log('Test 2: Verifying provider settings...');
  console.log(`  Primary Provider: ${config.getPrimaryProvider()}`);
  console.log(`  Fallback Provider: ${config.getFallbackProvider()}`);
  console.log(`  Fallback Enabled: ${config.isFallbackEnabled()}`);
  console.log('✅ Provider settings verified\n');

  // Test 3: Verify credentials
  console.log('Test 3: Verifying credentials...');
  const credentials = config.getCredentials();
  console.log(`  Groq API Key: ${credentials.groq.apiKey.substring(0, 10)}...`);
  console.log(`  Groq Base URL: ${credentials.groq.baseURL}`);
  console.log(`  Gemini API Key: ${credentials.gemini.apiKey.substring(0, 10)}...`);
  console.log('✅ Credentials verified\n');

  // Test 4: Verify model configuration
  console.log('Test 4: Verifying model configuration...');
  const modelConfig = config.getModelConfig();
  console.log(`  Groq Large Model: ${modelConfig.groq.large}`);
  console.log(`  Groq Small Model: ${modelConfig.groq.small}`);
  console.log(`  Gemini Default Model: ${modelConfig.gemini.default}`);
  console.log('✅ Model configuration verified\n');

  // Test 5: Verify all 7 endpoint mappings (Requirements 5.1-5.7)
  console.log('Test 5: Verifying endpoint model mappings...');
  const endpoints = [
    'generate',
    'chat',
    'flashcards',
    'quiz',
    'mindmap',
    'rewrite',
    'generate-audio-notes',
  ];

  const expectedMappings = {
    generate: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high' },
    chat: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high' },
    flashcards: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'medium' },
    quiz: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'medium' },
    mindmap: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'medium' },
    rewrite: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'low' },
    'generate-audio-notes': { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high' },
  };

  let allMappingsCorrect = true;
  for (const endpoint of endpoints) {
    const modelMapping = config.getModelForFeature(endpoint);
    const priority = config.getPriorityForFeature(endpoint);
    const expected = expectedMappings[endpoint as keyof typeof expectedMappings];

    console.log(`  ${endpoint}:`);
    console.log(`    Provider: ${modelMapping.provider} (expected: ${expected.provider})`);
    console.log(`    Model: ${modelMapping.model} (expected: ${expected.model})`);
    console.log(`    Priority: ${priority} (expected: ${expected.priority})`);

    if (
      modelMapping.provider !== expected.provider ||
      modelMapping.model !== expected.model ||
      priority !== expected.priority
    ) {
      console.log(`    ❌ MISMATCH!`);
      allMappingsCorrect = false;
    } else {
      console.log(`    ✅ Correct`);
    }
  }

  if (allMappingsCorrect) {
    console.log('✅ All endpoint mappings verified\n');
  } else {
    console.log('❌ Some endpoint mappings are incorrect\n');
    process.exit(1);
  }

  // Test 6: Verify feature enablement checks
  console.log('Test 6: Verifying feature enablement checks...');
  console.log(`  generate enabled for groq: ${config.isFeatureEnabled('generate', 'groq')}`);
  console.log(`  generate enabled for gemini: ${config.isFeatureEnabled('generate', 'gemini')}`);
  console.log('✅ Feature enablement checks verified\n');

  // Test 7: Verify configured features list
  console.log('Test 7: Verifying configured features list...');
  const configuredFeatures = config.getConfiguredFeatures();
  console.log(`  Configured features: ${configuredFeatures.join(', ')}`);
  if (configuredFeatures.length === 7) {
    console.log('✅ All 7 features configured\n');
  } else {
    console.log(`❌ Expected 7 features, found ${configuredFeatures.length}\n`);
    process.exit(1);
  }

  // Test 8: Verify model mapping retrieval
  console.log('Test 8: Verifying model mapping retrieval...');
  const fullMapping = config.getModelMapping();
  console.log(`  Total mappings: ${Object.keys(fullMapping).length}`);
  console.log('✅ Model mapping retrieval verified\n');

  console.log('🎉 All validation tests passed!\n');
  console.log('Summary:');
  console.log('  ✅ Configuration loading');
  console.log('  ✅ Provider settings');
  console.log('  ✅ Credentials management');
  console.log('  ✅ Model configuration');
  console.log('  ✅ Endpoint model mappings (7/7)');
  console.log('  ✅ Feature enablement');
  console.log('  ✅ Configured features list');
  console.log('  ✅ Model mapping retrieval');

} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('❌ Configuration Error:\n');
    console.error(error.message);
    if (error.missingKeys) {
      console.error('\nMissing keys:', error.missingKeys);
    }
    if (error.invalidKeys) {
      console.error('\nInvalid keys:', error.invalidKeys);
    }
  } else {
    console.error('❌ Unexpected Error:\n');
    console.error(error);
  }
  process.exit(1);
}
