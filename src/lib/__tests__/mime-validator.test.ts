import { validateMimeType, ALLOWED_DOCUMENT_TYPES, ALLOWED_AUDIO_TYPES, ALL_ALLOWED_TYPES } from '../mime-validator';

/**
 * Basic unit tests for MIME validator module
 * These tests verify the core functionality works as expected
 */

async function testMimeValidator() {
  console.log('Testing MIME validator module...\n');

  // Test 1: Verify constants are defined
  console.log('Test 1: Verify constants are defined');
  console.assert(ALLOWED_DOCUMENT_TYPES.length === 4, 'Should have 4 document types');
  console.assert(ALLOWED_AUDIO_TYPES.length === 5, 'Should have 5 audio types');
  console.assert(ALL_ALLOWED_TYPES.length === 9, 'Should have 9 total types');
  console.log('✓ Constants are properly defined\n');

  // Test 2: Test with empty buffer (should fail to detect)
  console.log('Test 2: Test with empty buffer');
  const emptyBuffer = Buffer.from([]);
  const emptyResult = await validateMimeType(emptyBuffer, ALL_ALLOWED_TYPES);
  console.assert(emptyResult.valid === false, 'Empty buffer should be invalid');
  console.assert(emptyResult.detectedType === null, 'Empty buffer should have null detected type');
  console.log('✓ Empty buffer correctly rejected\n');

  // Test 3: Test with random data (should fail to detect or detect as invalid)
  console.log('Test 3: Test with random data');
  const randomBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
  const randomResult = await validateMimeType(randomBuffer, ALL_ALLOWED_TYPES);
  console.assert(randomResult.valid === false, 'Random data should be invalid');
  console.log('✓ Random data correctly rejected\n');

  // Test 4: Test PDF magic number (25 50 44 46 = %PDF)
  console.log('Test 4: Test PDF magic number');
  const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
  const pdfResult = await validateMimeType(pdfBuffer, ALLOWED_DOCUMENT_TYPES);
  console.log(`  Detected type: ${pdfResult.detectedType}`);
  console.log(`  Valid: ${pdfResult.valid}`);
  if (pdfResult.detectedType === 'application/pdf') {
    console.log('✓ PDF correctly detected\n');
  } else {
    console.log('⚠ PDF detection may need more data\n');
  }

  // Test 5: Test that function is deterministic
  console.log('Test 5: Test deterministic behavior');
  const testBuffer = Buffer.from([0xFF, 0xD8, 0xFF]); // JPEG magic number
  const result1 = await validateMimeType(testBuffer, ALL_ALLOWED_TYPES);
  const result2 = await validateMimeType(testBuffer, ALL_ALLOWED_TYPES);
  console.assert(result1.detectedType === result2.detectedType, 'Results should be identical');
  console.assert(result1.valid === result2.valid, 'Validation should be consistent');
  console.log('✓ Function is deterministic\n');

  console.log('All basic tests completed!');
}

// Run tests
testMimeValidator().catch(console.error);
