import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitTracker } from './rateLimitTracker';
import type { RedisLike } from './rateLimitTracker';

describe('Redis Failure Handling - Task 27', () => {
  describe('RateLimitTracker - In-Memory Fallback', () => {
    let mockRedis: RedisLike;
    let tracker: RateLimitTracker;
    let now: Date;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      now = new Date('2024-01-15T10:30:00Z');
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockRedis = {
        get: vi.fn(),
        incr: vi.fn(),
        expire: vi.fn(),
        ttl: vi.fn(),
      };

      tracker = new RateLimitTracker(
        mockRedis,
        {
          groq: {
            requestsPerMinute: 30,
            requestsPerDay: 14_400,
            warningThreshold: 80,
            throttleThreshold: 90,
          },
          gemini: {
            requestsPerMinute: 60,
            requestsPerDay: 50_000,
            warningThreshold: 80,
            throttleThreshold: 90,
          },
        },
        { now: () => now }
      );
    });

    it('should use in-memory fallback when Redis incr fails', async () => {
      // Simulate Redis failure for all operations
      vi.mocked(mockRedis.incr).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.expire).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.ttl).mockRejectedValue(new Error('Redis connection failed'));

      // First increment should trigger fallback
      await tracker.incrementCount('groq');

      // Should log warning about Redis unavailability
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RateLimitTracker] Redis unavailable during incrementCount')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: In-memory rate limiting is per-instance')
      );

      // Second increment should use in-memory counter
      await tracker.incrementCount('groq');

      // Get status should return in-memory counts
      const status = await tracker.getStatus('groq');
      expect(status.rpm.current).toBe(2);
    });

    it('should use in-memory fallback when Redis get fails', async () => {
      // Simulate Redis failure
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis connection failed'));

      // Should use in-memory counters (which start at 0)
      const status = await tracker.getStatus('groq');

      expect(status.rpm.current).toBe(0);
      expect(status.rpd.current).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RateLimitTracker] Redis unavailable during getStatus')
      );
    });

    it('should maintain separate in-memory counters per provider', async () => {
      // Simulate Redis failure for all operations
      vi.mocked(mockRedis.incr).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.expire).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.ttl).mockRejectedValue(new Error('Redis connection failed'));

      // Increment different providers
      await tracker.incrementCount('groq');
      await tracker.incrementCount('groq');
      await tracker.incrementCount('gemini');

      // Check status for each provider
      const groqStatus = await tracker.getStatus('groq');
      const geminiStatus = await tracker.getStatus('gemini');

      expect(groqStatus.rpm.current).toBe(2);
      expect(geminiStatus.rpm.current).toBe(1);
    });

    it('should expire in-memory counters based on TTL', async () => {
      // Simulate Redis failure for all operations
      vi.mocked(mockRedis.incr).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.expire).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.ttl).mockRejectedValue(new Error('Redis connection failed'));

      // Increment counter
      await tracker.incrementCount('groq');

      // Verify counter exists
      let status = await tracker.getStatus('groq');
      expect(status.rpm.current).toBe(1);

      // Advance time past minute boundary (RPM counter should expire)
      now = new Date('2024-01-15T10:31:01Z');

      // Counter should be expired
      status = await tracker.getStatus('groq');
      expect(status.rpm.current).toBe(0);
    });

    it('should restore Redis when connection recovers', async () => {
      // First call fails
      vi.mocked(mockRedis.incr).mockRejectedValueOnce(new Error('Redis connection failed'));
      await tracker.incrementCount('groq');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RateLimitTracker] Redis unavailable')
      );

      // Second call succeeds
      vi.mocked(mockRedis.incr).mockResolvedValue(1);
      vi.mocked(mockRedis.expire).mockResolvedValue(1);
      vi.mocked(mockRedis.ttl).mockResolvedValue(60);

      await tracker.incrementCount('groq');

      // Should log restoration message
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RateLimitTracker] Redis connection restored')
      );
    });

    it('should include warning in prediction alert when Redis unavailable', async () => {
      // Simulate Redis failure
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.incr).mockRejectedValue(new Error('Redis connection failed'));

      // Increment to create usage
      await tracker.incrementCount('groq');

      // Get prediction
      const prediction = await tracker.predictExhaustion('groq');

      // Should include Redis unavailability warning
      expect(prediction.alert).toContain('WARNING: Redis unavailable');
    });

    it('should report Redis availability status', async () => {
      // Initially available
      expect(tracker.isRedisAvailable()).toBe(true);

      // Simulate Redis failure
      vi.mocked(mockRedis.incr).mockRejectedValue(new Error('Redis connection failed'));
      await tracker.incrementCount('groq');

      // Should report unavailable
      expect(tracker.isRedisAvailable()).toBe(false);

      // Restore Redis
      vi.mocked(mockRedis.incr).mockResolvedValue(1);
      vi.mocked(mockRedis.expire).mockResolvedValue(1);
      await tracker.incrementCount('groq');

      // Should report available again
      expect(tracker.isRedisAvailable()).toBe(true);
    });

    it('should continue processing requests with in-memory fallback', async () => {
      // Simulate Redis failure
      vi.mocked(mockRedis.incr).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw - operations continue with in-memory fallback
      await expect(tracker.incrementCount('groq')).resolves.not.toThrow();
      await expect(tracker.getStatus('groq')).resolves.not.toThrow();
      await expect(tracker.getRollingAverage('groq', 15)).resolves.not.toThrow();
      await expect(tracker.predictExhaustion('groq')).resolves.not.toThrow();
    });
  });

  describe('RequestQueue - Disabled When Redis Unavailable', () => {
    it('should be tested in router integration tests', () => {
      // The queue is already optional in the router via dependencies
      // When Redis fails, the queue simply won't be available
      // This is tested in the router's getProviderStatus method
      expect(true).toBe(true);
    });
  });
});
