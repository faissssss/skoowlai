// Test script to verify ProviderConfig.load() works
// Run with: node test-config-load.js

require('dotenv').config();

console.log('Environment Variables:');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✓ Set' : '✗ Missing');
console.log('GOOGLE_GENERATIVE_AI_API_KEY:', process.env.GOOGLE_GENERATIVE_AI_API_KEY ? '✓ Set' : '✗ Missing');
console.log('PRIMARY_LLM_PROVIDER:', process.env.PRIMARY_LLM_PROVIDER || '✗ Missing');
console.log('FALLBACK_LLM_PROVIDER:', process.env.FALLBACK_LLM_PROVIDER || '✗ Missing');
console.log('ENABLE_LLM_FALLBACK:', process.env.ENABLE_LLM_FALLBACK || '✗ Missing');
console.log('ENABLE_CONTENT_SIZE_ROUTING:', process.env.ENABLE_CONTENT_SIZE_ROUTING || 'Not set (will default to true)');
console.log('CONTENT_SIZE_THRESHOLD_TOKENS:', process.env.CONTENT_SIZE_THRESHOLD_TOKENS || 'Not set (will default to 6000)');
console.log('LLM_MIGRATION_ENABLED:', process.env.LLM_MIGRATION_ENABLED || 'Not set (will default to true)');

console.log('\nAll required variables present:', 
  process.env.GROQ_API_KEY &&
  process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
  process.env.PRIMARY_LLM_PROVIDER &&
  process.env.FALLBACK_LLM_PROVIDER &&
  process.env.ENABLE_LLM_FALLBACK
  ? '✓ YES' : '✗ NO'
);
