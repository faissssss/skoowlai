/**
 * Test script to verify Groq API connection
 * 
 * This script makes a simple API call to Groq to verify:
 * - API key is valid
 * - Connection works
 * - Models are accessible
 */

import { config as loadEnv } from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
loadEnv();

console.log('🔍 Testing Groq API Connection...\n');

async function testGroqConnection() {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      throw new Error('GROQ_API_KEY not found in environment variables');
    }

    console.log(`✅ API Key found: ${apiKey.substring(0, 10)}...\n`);

    // Initialize Groq client (OpenAI-compatible)
    const groq = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    // Test 1: Small model (Llama 3.1 8B)
    console.log('Test 1: Testing Llama 3.1 8B (small model)...');
    
    const result1 = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'user', content: 'Say "Hello from Groq!" in exactly 5 words.' }
      ],
      max_tokens: 20,
      temperature: 0.7,
    });

    const response1 = result1.choices[0]?.message?.content || 'No response';
    console.log(`  Response: "${response1}"`);
    console.log(`  Tokens: ${result1.usage?.total_tokens || 'N/A'}`);
    console.log('✅ Llama 3.1 8B working!\n');

    // Test 2: Large model (Llama 3.3 70B)
    console.log('Test 2: Testing Llama 3.3 70B (large model)...');
    
    const result2 = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'user', content: 'What is 2+2? Answer in one word.' }
      ],
      max_tokens: 10,
      temperature: 0.7,
    });

    const response2 = result2.choices[0]?.message?.content || 'No response';
    console.log(`  Response: "${response2}"`);
    console.log(`  Tokens: ${result2.usage?.total_tokens || 'N/A'}`);
    console.log('✅ Llama 3.3 70B working!\n');

    console.log('🎉 All Groq API tests passed!\n');
    console.log('Summary:');
    console.log('  ✅ API key valid');
    console.log('  ✅ Connection successful');
    console.log('  ✅ Llama 3.1 8B accessible');
    console.log('  ✅ Llama 3.3 70B accessible');
    console.log('\n✨ Your Groq API is ready to use!');

  } catch (error) {
    console.error('❌ Groq API Test Failed:\n');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.error('\n💡 Tip: Your API key may be invalid. Please check:');
        console.error('  1. The API key in your .env file');
        console.error('  2. That the key is active in your Groq Cloud dashboard');
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        console.error('\n💡 Tip: Rate limit exceeded. Please wait a moment and try again.');
      } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        console.error('\n💡 Tip: Network connection issue. Please check your internet connection.');
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

testGroqConnection();
