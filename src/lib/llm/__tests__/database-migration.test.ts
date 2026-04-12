import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Database Migration - LLM Cost Tracking', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('LlmRequest model', () => {
    it('should create and retrieve an LLM request record', async () => {
      const testRequest = {
        timestamp: new Date(),
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        feature: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.0001,
        latencyMs: 250,
        success: true,
        fallbackUsed: false,
        requestId: `test-${Date.now()}`,
      };

      const created = await prisma.llmRequest.create({
        data: testRequest,
      });

      expect(created.id).toBeDefined();
      expect(created.provider).toBe('groq');
      expect(created.model).toBe('llama-3.3-70b-versatile');
      expect(created.feature).toBe('chat');
      expect(created.inputTokens).toBe(100);
      expect(created.outputTokens).toBe(50);
      expect(created.estimatedCost).toBe(0.0001);
      expect(created.latencyMs).toBe(250);
      expect(created.success).toBe(true);
      expect(created.fallbackUsed).toBe(false);

      // Cleanup
      await prisma.llmRequest.delete({ where: { id: created.id } });
    });

    it('should support optional userId field', async () => {
      const testRequest = {
        timestamp: new Date(),
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        feature: 'generate',
        inputTokens: 200,
        outputTokens: 100,
        estimatedCost: 0.0002,
        latencyMs: 300,
        success: true,
        fallbackUsed: false,
        userId: 'user_123',
        requestId: `test-${Date.now()}`,
      };

      const created = await prisma.llmRequest.create({
        data: testRequest,
      });

      expect(created.userId).toBe('user_123');

      // Cleanup
      await prisma.llmRequest.delete({ where: { id: created.id } });
    });

    it('should support error tracking with errorCode', async () => {
      const testRequest = {
        timestamp: new Date(),
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        feature: 'flashcards',
        inputTokens: 50,
        outputTokens: 0,
        estimatedCost: 0,
        latencyMs: 100,
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        fallbackUsed: true,
        requestId: `test-${Date.now()}`,
      };

      const created = await prisma.llmRequest.create({
        data: testRequest,
      });

      expect(created.success).toBe(false);
      expect(created.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      expect(created.fallbackUsed).toBe(true);

      // Cleanup
      await prisma.llmRequest.delete({ where: { id: created.id } });
    });

    it('should enforce unique requestId constraint', async () => {
      const requestId = `test-unique-${Date.now()}`;
      const testRequest = {
        timestamp: new Date(),
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        feature: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.0001,
        latencyMs: 250,
        success: true,
        fallbackUsed: false,
        requestId,
      };

      const first = await prisma.llmRequest.create({ data: testRequest });

      // Attempting to create another record with the same requestId should fail
      await expect(
        prisma.llmRequest.create({ data: testRequest })
      ).rejects.toThrow();

      // Cleanup
      await prisma.llmRequest.delete({ where: { id: first.id } });
    });

    it('should support querying by timestamp index', async () => {
      const now = new Date();
      const testRequest = {
        timestamp: now,
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        feature: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.0001,
        latencyMs: 250,
        success: true,
        fallbackUsed: false,
        requestId: `test-${Date.now()}`,
      };

      const created = await prisma.llmRequest.create({ data: testRequest });

      // Query by timestamp
      const results = await prisma.llmRequest.findMany({
        where: {
          timestamp: {
            gte: new Date(now.getTime() - 1000),
            lte: new Date(now.getTime() + 1000),
          },
        },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === created.id)).toBe(true);

      // Cleanup
      await prisma.llmRequest.delete({ where: { id: created.id } });
    });

    it('should support querying by provider index', async () => {
      const testRequest = {
        timestamp: new Date(),
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        feature: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.0001,
        latencyMs: 250,
        success: true,
        fallbackUsed: false,
        requestId: `test-${Date.now()}`,
      };

      const created = await prisma.llmRequest.create({ data: testRequest });

      // Query by provider
      const results = await prisma.llmRequest.findMany({
        where: { provider: 'groq' },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === created.id)).toBe(true);

      // Cleanup
      await prisma.llmRequest.delete({ where: { id: created.id } });
    });

    it('should support querying by feature index', async () => {
      const testRequest = {
        timestamp: new Date(),
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        feature: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.0001,
        latencyMs: 250,
        success: true,
        fallbackUsed: false,
        requestId: `test-${Date.now()}`,
      };

      const created = await prisma.llmRequest.create({ data: testRequest });

      // Query by feature
      const results = await prisma.llmRequest.findMany({
        where: { feature: 'chat' },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === created.id)).toBe(true);

      // Cleanup
      await prisma.llmRequest.delete({ where: { id: created.id } });
    });
  });

  describe('CostSummary model', () => {
    it('should create and retrieve a cost summary record', async () => {
      const testSummary = {
        provider: 'groq',
        feature: 'chat',
        date: new Date('2026-04-12'),
        totalRequests: 100,
        totalTokens: 5000,
        totalCost: 0.01,
        avgLatencyMs: 250.5,
        successRate: 0.98,
      };

      const created = await prisma.costSummary.create({
        data: testSummary,
      });

      expect(created.id).toBeDefined();
      expect(created.provider).toBe('groq');
      expect(created.feature).toBe('chat');
      expect(created.totalRequests).toBe(100);
      expect(created.totalTokens).toBe(5000);
      expect(created.totalCost).toBe(0.01);
      expect(created.avgLatencyMs).toBe(250.5);
      expect(created.successRate).toBe(0.98);

      // Cleanup
      await prisma.costSummary.delete({ where: { id: created.id } });
    });

    it('should enforce unique constraint on provider, feature, and date', async () => {
      const testSummary = {
        provider: 'groq',
        feature: 'generate',
        date: new Date('2026-04-12'),
        totalRequests: 50,
        totalTokens: 2500,
        totalCost: 0.005,
        avgLatencyMs: 200.0,
        successRate: 1.0,
      };

      const first = await prisma.costSummary.create({ data: testSummary });

      // Attempting to create another record with the same provider, feature, and date should fail
      await expect(
        prisma.costSummary.create({ data: testSummary })
      ).rejects.toThrow();

      // Cleanup
      await prisma.costSummary.delete({ where: { id: first.id } });
    });

    it('should support querying by provider index', async () => {
      const testSummary = {
        provider: 'gemini',
        feature: 'flashcards',
        date: new Date('2026-04-12'),
        totalRequests: 75,
        totalTokens: 3750,
        totalCost: 0.0075,
        avgLatencyMs: 300.0,
        successRate: 0.95,
      };

      const created = await prisma.costSummary.create({ data: testSummary });

      // Query by provider
      const results = await prisma.costSummary.findMany({
        where: { provider: 'gemini' },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === created.id)).toBe(true);

      // Cleanup
      await prisma.costSummary.delete({ where: { id: created.id } });
    });

    it('should support querying by date index', async () => {
      const testDate = new Date('2026-04-12');
      const testSummary = {
        provider: 'groq',
        feature: 'quiz',
        date: testDate,
        totalRequests: 60,
        totalTokens: 3000,
        totalCost: 0.006,
        avgLatencyMs: 220.0,
        successRate: 0.97,
      };

      const created = await prisma.costSummary.create({ data: testSummary });

      // Query by date
      const results = await prisma.costSummary.findMany({
        where: {
          date: {
            gte: new Date('2026-04-12'),
            lt: new Date('2026-04-13'),
          },
        },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === created.id)).toBe(true);

      // Cleanup
      await prisma.costSummary.delete({ where: { id: created.id } });
    });

    it('should support aggregating multiple summaries', async () => {
      const summaries = [
        {
          provider: 'groq',
          feature: 'chat',
          date: new Date('2026-04-10'),
          totalRequests: 100,
          totalTokens: 5000,
          totalCost: 0.01,
          avgLatencyMs: 250.0,
          successRate: 0.98,
        },
        {
          provider: 'groq',
          feature: 'chat',
          date: new Date('2026-04-11'),
          totalRequests: 120,
          totalTokens: 6000,
          totalCost: 0.012,
          avgLatencyMs: 260.0,
          successRate: 0.99,
        },
        {
          provider: 'groq',
          feature: 'chat',
          date: new Date('2026-04-12'),
          totalRequests: 110,
          totalTokens: 5500,
          totalCost: 0.011,
          avgLatencyMs: 255.0,
          successRate: 0.97,
        },
      ];

      const created = await Promise.all(
        summaries.map((s) => prisma.costSummary.create({ data: s }))
      );

      // Aggregate total cost for groq chat feature
      const aggregate = await prisma.costSummary.aggregate({
        where: {
          provider: 'groq',
          feature: 'chat',
          date: {
            gte: new Date('2026-04-10'),
            lte: new Date('2026-04-12'),
          },
        },
        _sum: {
          totalRequests: true,
          totalTokens: true,
          totalCost: true,
        },
        _avg: {
          avgLatencyMs: true,
          successRate: true,
        },
      });

      expect(aggregate._sum.totalRequests).toBe(330);
      expect(aggregate._sum.totalTokens).toBe(16500);
      expect(aggregate._sum.totalCost).toBeCloseTo(0.033, 3);

      // Cleanup
      await Promise.all(
        created.map((c) => prisma.costSummary.delete({ where: { id: c.id } }))
      );
    });
  });
});
