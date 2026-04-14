/**
 * Task 3.3: Verify retry logic in PrismaCostStorage
 * 
 * This test verifies that the PrismaCostStorage.insert() method
 * uses withRetry() to handle transient database connection failures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Task 3.3: PrismaCostStorage Retry Logic', () => {
  it('should import withRetry from @/lib/db', async () => {
    // Read the service.ts file to verify the import
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const servicePath = path.join(process.cwd(), 'src/lib/llm/service.ts');
    const content = await fs.readFile(servicePath, 'utf-8');
    
    // Verify withRetry is imported from @/lib/db
    expect(content).toContain("import { db, warmupConnection, withRetry } from '@/lib/db'");
  });

  it('should wrap db.llmRequest.upsert() with withRetry()', async () => {
    // Read the service.ts file to verify the implementation
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const servicePath = path.join(process.cwd(), 'src/lib/llm/service.ts');
    const content = await fs.readFile(servicePath, 'utf-8');
    
    // Find the PrismaCostStorage class
    const prismaCostStorageMatch = content.match(/class PrismaCostStorage[\s\S]*?async insert\([\s\S]*?\{[\s\S]*?\}/);
    
    expect(prismaCostStorageMatch).toBeTruthy();
    
    if (prismaCostStorageMatch) {
      const insertMethod = prismaCostStorageMatch[0];
      
      // Verify withRetry is used
      expect(insertMethod).toContain('withRetry');
      
      // Verify it wraps the upsert call
      expect(insertMethod).toContain('withRetry(() => db.llmRequest.upsert');
      
      // Verify the upsert call is inside the withRetry callback
      expect(insertMethod).toMatch(/withRetry\(\(\) => db\.llmRequest\.upsert\(/);
    }
  });

  it('should handle connection errors with exponential backoff', async () => {
    // This test verifies the behavior described in the task:
    // - Handle cold start connection delays with exponential backoff (3 attempts)
    // - Retry transient connection failures (P1001, P1002 error codes)
    
    const { withRetry } = await import('@/lib/db');
    
    let attempts = 0;
    const mockOperation = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        const error: any = new Error("Can't reach database server");
        error.code = 'P1001';
        throw error;
      }
      return { success: true };
    });
    
    const result = await withRetry(mockOperation);
    
    // Should succeed after retries
    expect(result).toEqual({ success: true });
    
    // Should have attempted 3 times
    expect(attempts).toBe(3);
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  it('should retry on P1002 timeout errors', async () => {
    const { withRetry } = await import('@/lib/db');
    
    let attempts = 0;
    const mockOperation = vi.fn(async () => {
      attempts++;
      if (attempts < 2) {
        const error: any = new Error("Connection timed out");
        error.code = 'P1002';
        throw error;
      }
      return { success: true };
    });
    
    const result = await withRetry(mockOperation);
    
    expect(result).toEqual({ success: true });
    expect(attempts).toBe(2);
  });

  it('should throw after max retries on persistent connection errors', async () => {
    const { withRetry } = await import('@/lib/db');
    
    const mockOperation = vi.fn(async () => {
      const error: any = new Error("Can't reach database server");
      error.code = 'P1001';
      throw error;
    });
    
    await expect(withRetry(mockOperation)).rejects.toThrow("Can't reach database server");
    
    // Should have attempted 3 times (default maxRetries)
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-connection errors', async () => {
    const { withRetry } = await import('@/lib/db');
    
    const mockOperation = vi.fn(async () => {
      const error: any = new Error("Invalid data");
      error.code = 'P2002'; // Unique constraint violation
      throw error;
    });
    
    await expect(withRetry(mockOperation)).rejects.toThrow("Invalid data");
    
    // Should only attempt once (no retry for non-connection errors)
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });
});
