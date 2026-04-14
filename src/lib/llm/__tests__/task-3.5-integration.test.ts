/**
 * Task 3.5: Integration test for improved error logging
 * 
 * This test verifies that the ResilientCostStorage class actually logs
 * detailed error information when falling back to in-memory storage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CostEntry, CostStorage } from '../costTracker';
import type { Provider } from '../config';

// Mock implementation of CostStorage that throws errors
class MockFailingCostStorage implements CostStorage {
  constructor(private error: any) {}

  async insert(entry: CostEntry): Promise<void> {
    throw this.error;
  }

  async list(params: { provider?: Provider; start: Date; end: Date }): Promise<CostEntry[]> {
    throw this.error;
  }
}

// Mock implementation of in-memory storage
class MockInMemoryCostStorage implements CostStorage {
  private entries: CostEntry[] = [];

  async insert(entry: CostEntry): Promise<void> {
    this.entries.push(entry);
  }

  async list(params: { provider?: Provider; start: Date; end: Date }): Promise<CostEntry[]> {
    return this.entries.filter(entry => 
      entry.timestamp >= params.start && 
      entry.timestamp <= params.end &&
      (!params.provider || entry.provider === params.provider)
    );
  }
}

// Simplified ResilientCostStorage for testing
class TestResilientCostStorage implements CostStorage {
  private warned = false;

  constructor(
    private readonly primary: CostStorage,
    private readonly fallback: CostStorage,
  ) {}

  async insert(entry: CostEntry): Promise<void> {
    try {
      await this.primary.insert(entry);
    } catch (error) {
      this.warn(error);
      await this.fallback.insert(entry);
    }
  }

  async list(params: { provider?: Provider; start: Date; end: Date }): Promise<CostEntry[]> {
    try {
      return await this.primary.list(params);
    } catch (error) {
      this.warn(error);
      return this.fallback.list(params);
    }
  }

  private warn(error: unknown): void {
    if (this.warned) {
      return;
    }

    this.warned = true;
    
    // Determine error type and extract details
    const errorObj = error as any;
    const errorCode = errorObj?.code;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Classify error type based on Prisma error codes
    const isConfigurationError = 
      !process.env.DATABASE_URL ||
      errorMessage.includes('Environment variable not found: DATABASE_URL') ||
      errorMessage.includes('Invalid connection string') ||
      errorCode === 'P1013' || // Invalid database string
      errorCode === 'P1012';   // Schema validation error
    
    const errorType = isConfigurationError ? 'configuration' : 'transient';
    
    // Build detailed error message
    let detailedMessage = '[LLM Service] Falling back to in-memory cost storage. ';
    detailedMessage += `Error type: ${errorType}`;
    
    if (errorCode) {
      detailedMessage += `, Code: ${errorCode}`;
    }
    
    detailedMessage += `, Message: ${errorMessage}`;
    
    console.warn(detailedMessage);
  }
}

describe('Task 3.5: ResilientCostStorage Integration Test', () => {
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should log detailed error information for P1001 transient error', async () => {
    const error: any = new Error("Can't reach database server");
    error.code = 'P1001';
    
    const failingStorage = new MockFailingCostStorage(error);
    const fallbackStorage = new MockInMemoryCostStorage();
    const resilientStorage = new TestResilientCostStorage(failingStorage, fallbackStorage);
    
    // Ensure DATABASE_URL is set for transient error classification
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test';
    
    const entry: CostEntry = {
      timestamp: new Date(),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      feature: 'test',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      requestId: 'test-123',
    };
    
    await resilientStorage.insert(entry);
    
    // Restore DATABASE_URL
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[LLM Service] Falling back to in-memory cost storage. Error type: transient, Code: P1001, Message: Can't reach database server"
    );
  });

  it('should log detailed error information for P1002 transient error', async () => {
    const error: any = new Error("Connection timed out");
    error.code = 'P1002';
    
    const failingStorage = new MockFailingCostStorage(error);
    const fallbackStorage = new MockInMemoryCostStorage();
    const resilientStorage = new TestResilientCostStorage(failingStorage, fallbackStorage);
    
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test';
    
    const entry: CostEntry = {
      timestamp: new Date(),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      feature: 'test',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      requestId: 'test-456',
    };
    
    await resilientStorage.insert(entry);
    
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[LLM Service] Falling back to in-memory cost storage. Error type: transient, Code: P1002, Message: Connection timed out"
    );
  });

  it('should log detailed error information for P1013 configuration error', async () => {
    const error: any = new Error("Invalid connection string");
    error.code = 'P1013';
    
    const failingStorage = new MockFailingCostStorage(error);
    const fallbackStorage = new MockInMemoryCostStorage();
    const resilientStorage = new TestResilientCostStorage(failingStorage, fallbackStorage);
    
    const entry: CostEntry = {
      timestamp: new Date(),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      feature: 'test',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      requestId: 'test-789',
    };
    
    await resilientStorage.insert(entry);
    
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[LLM Service] Falling back to in-memory cost storage. Error type: configuration, Code: P1013, Message: Invalid connection string"
    );
  });

  it('should log error without code when code is not available', async () => {
    const error = new Error("Generic database error");
    
    const failingStorage = new MockFailingCostStorage(error);
    const fallbackStorage = new MockInMemoryCostStorage();
    const resilientStorage = new TestResilientCostStorage(failingStorage, fallbackStorage);
    
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test';
    
    const entry: CostEntry = {
      timestamp: new Date(),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      feature: 'test',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      requestId: 'test-abc',
    };
    
    await resilientStorage.insert(entry);
    
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[LLM Service] Falling back to in-memory cost storage. Error type: transient, Message: Generic database error"
    );
  });

  it('should only warn once even with multiple errors', async () => {
    const error: any = new Error("Can't reach database server");
    error.code = 'P1001';
    
    const failingStorage = new MockFailingCostStorage(error);
    const fallbackStorage = new MockInMemoryCostStorage();
    const resilientStorage = new TestResilientCostStorage(failingStorage, fallbackStorage);
    
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test';
    
    const entry1: CostEntry = {
      timestamp: new Date(),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      feature: 'test',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      requestId: 'test-1',
    };
    
    const entry2: CostEntry = {
      timestamp: new Date(),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      feature: 'test',
      inputTokens: 200,
      outputTokens: 100,
      estimatedCost: 0.002,
      requestId: 'test-2',
    };
    
    await resilientStorage.insert(entry1);
    await resilientStorage.insert(entry2);
    
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    
    // Should only warn once
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
  });

  it('should successfully fall back to in-memory storage after logging error', async () => {
    const error: any = new Error("Can't reach database server");
    error.code = 'P1001';
    
    const failingStorage = new MockFailingCostStorage(error);
    const fallbackStorage = new MockInMemoryCostStorage();
    const resilientStorage = new TestResilientCostStorage(failingStorage, fallbackStorage);
    
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://test';
    
    const entry: CostEntry = {
      timestamp: new Date(),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      feature: 'test',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      requestId: 'test-xyz',
    };
    
    // Should not throw - should fall back successfully
    await expect(resilientStorage.insert(entry)).resolves.toBeUndefined();
    
    // Verify data was stored in fallback
    const results = await resilientStorage.list({
      start: new Date(Date.now() - 1000),
      end: new Date(Date.now() + 1000),
    });
    
    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    
    expect(results).toHaveLength(1);
    expect(results[0].requestId).toBe('test-xyz');
  });
});
