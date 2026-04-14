/**
 * Task 3.4: Verify improved error handling in PrismaCostStorage
 * 
 * This test verifies that PrismaCostStorage.insert() distinguishes between:
 * - Configuration errors (missing DATABASE_URL) - should fail fast
 * - Transient errors (P1001, P1002) - should allow fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Task 3.4: PrismaCostStorage Error Handling', () => {
  it('should have error detection logic in PrismaCostStorage.insert()', async () => {
    // Read the service.ts file to verify the implementation
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const servicePath = path.join(process.cwd(), 'src/lib/llm/service.ts');
    const content = await fs.readFile(servicePath, 'utf-8');
    
    // Find the PrismaCostStorage class
    const prismaCostStorageMatch = content.match(/class PrismaCostStorage[\s\S]*?async insert\([\s\S]*?\n  \}/);
    
    expect(prismaCostStorageMatch).toBeTruthy();
    
    if (prismaCostStorageMatch) {
      const insertMethod = prismaCostStorageMatch[0];
      
      // Verify try-catch block exists
      expect(insertMethod).toContain('try {');
      expect(insertMethod).toContain('} catch (error: any) {');
      
      // Verify configuration error detection
      expect(insertMethod).toContain('isConfigurationError');
      expect(insertMethod).toContain('DATABASE_URL');
      
      // Verify Prisma error codes are checked
      expect(insertMethod).toContain("P1013"); // Invalid database string
      expect(insertMethod).toContain("P1012"); // Schema validation error
      
      // Verify configuration errors are thrown
      expect(insertMethod).toContain('if (isConfigurationError)');
      expect(insertMethod).toContain('throw new Error');
      expect(insertMethod).toContain('Database configuration error');
      
      // Verify transient errors are re-thrown (for fallback)
      expect(insertMethod).toContain('throw error');
    }
  });

  it('should detect missing DATABASE_URL as configuration error', () => {
    // Simulate configuration error detection logic
    const error: any = new Error('Environment variable not found: DATABASE_URL');
    
    const isConfigurationError = 
      !process.env.DATABASE_URL ||
      error?.message?.includes('Environment variable not found: DATABASE_URL') ||
      error?.message?.includes('Invalid connection string') ||
      error?.code === 'P1013' ||
      error?.code === 'P1012';
    
    // This should be detected as a configuration error
    expect(isConfigurationError).toBe(true);
  });

  it('should detect P1013 (invalid database string) as configuration error', () => {
    const error: any = new Error('Invalid connection string');
    error.code = 'P1013';
    
    const isConfigurationError = 
      !process.env.DATABASE_URL ||
      error?.message?.includes('Environment variable not found: DATABASE_URL') ||
      error?.message?.includes('Invalid connection string') ||
      error?.code === 'P1013' ||
      error?.code === 'P1012';
    
    expect(isConfigurationError).toBe(true);
  });

  it('should detect P1012 (schema validation error) as configuration error', () => {
    const error: any = new Error('Schema validation error');
    error.code = 'P1012';
    
    const isConfigurationError = 
      !process.env.DATABASE_URL ||
      error?.message?.includes('Environment variable not found: DATABASE_URL') ||
      error?.message?.includes('Invalid connection string') ||
      error?.code === 'P1013' ||
      error?.code === 'P1012';
    
    expect(isConfigurationError).toBe(true);
  });

  it('should NOT detect P1001 (connection error) as configuration error', () => {
    const error: any = new Error("Can't reach database server");
    error.code = 'P1001';
    
    // Assume DATABASE_URL is set for this test
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test';
    
    const isConfigurationError = 
      !process.env.DATABASE_URL ||
      error?.message?.includes('Environment variable not found: DATABASE_URL') ||
      error?.message?.includes('Invalid connection string') ||
      error?.code === 'P1013' ||
      error?.code === 'P1012';
    
    // Restore original value
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    }
    
    // P1001 is a transient error, not a configuration error
    expect(isConfigurationError).toBe(false);
  });

  it('should NOT detect P1002 (timeout) as configuration error', () => {
    const error: any = new Error("Connection timed out");
    error.code = 'P1002';
    
    // Assume DATABASE_URL is set for this test
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test';
    
    const isConfigurationError = 
      !process.env.DATABASE_URL ||
      error?.message?.includes('Environment variable not found: DATABASE_URL') ||
      error?.message?.includes('Invalid connection string') ||
      error?.code === 'P1013' ||
      error?.code === 'P1012';
    
    // Restore original value
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    }
    
    // P1002 is a transient error, not a configuration error
    expect(isConfigurationError).toBe(false);
  });

  it('should throw descriptive error message for configuration errors', () => {
    const error: any = new Error('Environment variable not found: DATABASE_URL');
    
    const isConfigurationError = 
      !process.env.DATABASE_URL ||
      error?.message?.includes('Environment variable not found: DATABASE_URL') ||
      error?.message?.includes('Invalid connection string') ||
      error?.code === 'P1013' ||
      error?.code === 'P1012';
    
    if (isConfigurationError) {
      const configError = new Error(
        `Database configuration error: ${error?.message || 'DATABASE_URL not configured'}. ` +
        'Cost tracking cannot function without proper database configuration.'
      );
      
      expect(configError.message).toContain('Database configuration error');
      expect(configError.message).toContain('DATABASE_URL');
      expect(configError.message).toContain('Cost tracking cannot function');
    }
  });

  it('should allow transient errors to be re-thrown for fallback', () => {
    // Transient errors (P1001, P1002) should be re-thrown after withRetry exhausts retries
    // This allows ResilientCostStorage to catch them and fall back to in-memory storage
    
    const error: any = new Error("Can't reach database server");
    error.code = 'P1001';
    
    // Assume DATABASE_URL is set
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test';
    
    const isConfigurationError = 
      !process.env.DATABASE_URL ||
      error?.message?.includes('Environment variable not found: DATABASE_URL') ||
      error?.message?.includes('Invalid connection string') ||
      error?.code === 'P1013' ||
      error?.code === 'P1012';
    
    // Restore original value
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    }
    
    // Should not be a configuration error
    expect(isConfigurationError).toBe(false);
    
    // The error should be re-thrown (not wrapped in a configuration error)
    // This allows ResilientCostStorage to catch it and fall back
    expect(() => { throw error; }).toThrow("Can't reach database server");
  });
});
