import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ContentSizeDetector, Message } from './contentSizeDetector';

describe('ContentSizeDetector', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens using character count / 4 heuristic', () => {
      const detector = new ContentSizeDetector();
      const messages: Message[] = [
        { role: 'user', content: 'Hello world' }, // 11 chars
      ];

      const tokens = detector.estimateTokens(messages);
      expect(tokens).toBe(Math.ceil(11 / 4)); // 3 tokens
    });

    it('should count tokens from multiple messages', () => {
      const detector = new ContentSizeDetector();
      const messages: Message[] = [
        { role: 'user', content: 'Hello' }, // 5 chars
        { role: 'assistant', content: 'Hi there' }, // 8 chars
        { role: 'user', content: 'How are you?' }, // 12 chars
      ];

      const tokens = detector.estimateTokens(messages);
      expect(tokens).toBe(Math.ceil(25 / 4)); // 7 tokens
    });

    it('should include system prompt in token count', () => {
      const detector = new ContentSizeDetector();
      const messages: Message[] = [
        { role: 'user', content: 'Hello' }, // 5 chars
      ];
      const systemPrompt = 'You are a helpful assistant'; // 27 chars

      const tokens = detector.estimateTokens(messages, systemPrompt);
      expect(tokens).toBe(Math.ceil(32 / 4)); // 8 tokens
    });

    it('should handle empty messages', () => {
      const detector = new ContentSizeDetector();
      const messages: Message[] = [];

      const tokens = detector.estimateTokens(messages);
      expect(tokens).toBe(0);
    });
  });

  describe('getRoutingRecommendation', () => {
    it('should recommend Groq for small content below threshold', () => {
      const detector = new ContentSizeDetector({ thresholdTokens: 6000 });
      // 5000 tokens = 20000 chars
      const messages: Message[] = [
        { role: 'user', content: 'a'.repeat(20000) },
      ];

      const recommendation = detector.getRoutingRecommendation(messages);
      expect(recommendation.provider).toBe('groq');
      expect(recommendation.estimatedTokens).toBe(5000);
      expect(recommendation.reason).toContain('below threshold');
    });

    it('should recommend Gemini for large content above threshold', () => {
      const detector = new ContentSizeDetector({ thresholdTokens: 6000 });
      // 7000 tokens = 28000 chars
      const messages: Message[] = [
        { role: 'user', content: 'a'.repeat(28000) },
      ];

      const recommendation = detector.getRoutingRecommendation(messages);
      expect(recommendation.provider).toBe('gemini');
      expect(recommendation.estimatedTokens).toBe(7000);
      expect(recommendation.reason).toContain('above threshold');
    });

    it('should recommend Gemini when content exceeds Groq context limit', () => {
      const detector = new ContentSizeDetector({
        thresholdTokens: 6000,
        groqContextLimit: 8000,
      });
      // 9000 tokens = 36000 chars (exceeds Groq limit)
      const messages: Message[] = [
        { role: 'user', content: 'a'.repeat(36000) },
      ];

      const recommendation = detector.getRoutingRecommendation(messages);
      expect(recommendation.provider).toBe('gemini');
      expect(recommendation.estimatedTokens).toBe(9000);
      expect(recommendation.reason).toContain('exceeds Groq context limit');
    });

    it('should respect forceProvider flag', () => {
      const detector = new ContentSizeDetector({ thresholdTokens: 6000 });
      // Small content that would normally route to Groq
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
      ];

      const recommendation = detector.getRoutingRecommendation(
        messages,
        undefined,
        'gemini'
      );
      expect(recommendation.provider).toBe('gemini');
      expect(recommendation.reason).toContain('forced to gemini');
    });

    it('should return groq when routing is disabled', () => {
      const detector = new ContentSizeDetector({ enableRouting: false });
      const messages: Message[] = [
        { role: 'user', content: 'a'.repeat(28000) }, // Large content
      ];

      const recommendation = detector.getRoutingRecommendation(messages);
      expect(recommendation.provider).toBe('groq');
      expect(recommendation.reason).toContain('routing disabled');
    });

    it('should use custom threshold from config', () => {
      const detector = new ContentSizeDetector({ thresholdTokens: 3000 });
      // 4000 tokens = 16000 chars
      const messages: Message[] = [
        { role: 'user', content: 'a'.repeat(16000) },
      ];

      const recommendation = detector.getRoutingRecommendation(messages);
      expect(recommendation.provider).toBe('gemini');
      expect(recommendation.estimatedTokens).toBe(4000);
    });
  });

  describe('exceedsProviderLimit', () => {
    it('should return true when content exceeds Groq limit', () => {
      const detector = new ContentSizeDetector({ groqContextLimit: 8000 });
      // 9000 tokens = 36000 chars
      const messages: Message[] = [
        { role: 'user', content: 'a'.repeat(36000) },
      ];

      const exceeds = detector.exceedsProviderLimit(messages, 'groq');
      expect(exceeds).toBe(true);
    });

    it('should return false when content is within Groq limit', () => {
      const detector = new ContentSizeDetector({ groqContextLimit: 8000 });
      // 7000 tokens = 28000 chars
      const messages: Message[] = [
        { role: 'user', content: 'a'.repeat(28000) },
      ];

      const exceeds = detector.exceedsProviderLimit(messages, 'groq');
      expect(exceeds).toBe(false);
    });

    it('should return false for Gemini (large context window)', () => {
      const detector = new ContentSizeDetector();
      // Very large content
      const messages: Message[] = [
        { role: 'user', content: 'a'.repeat(100000) },
      ];

      const exceeds = detector.exceedsProviderLimit(messages, 'gemini');
      expect(exceeds).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const detector = new ContentSizeDetector({
        thresholdTokens: 5000,
        groqContextLimit: 7000,
        enableRouting: false,
      });

      const config = detector.getConfig();
      expect(config.thresholdTokens).toBe(5000);
      expect(config.groqContextLimit).toBe(7000);
      expect(config.enableRouting).toBe(false);
    });

    it('should use default values when not provided', () => {
      const detector = new ContentSizeDetector();

      const config = detector.getConfig();
      expect(config.thresholdTokens).toBe(6000);
      expect(config.groqContextLimit).toBe(8000);
      expect(config.enableRouting).toBe(true);
    });
  });

  // Property-based tests
  describe('Property 34: Content-Size-Based Routing', () => {
    it('should route requests below threshold to Groq, above threshold to Gemini', () => {
      // Feature: llm-provider-migration, Property 34: Content-Size-Based Routing
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 50000 }), // Character count
          fc.integer({ min: 1000, max: 10000 }), // Threshold
          (charCount, threshold) => {
            const detector = new ContentSizeDetector({
              thresholdTokens: threshold,
              groqContextLimit: 20000, // High enough to not interfere
            });

            const messages: Message[] = [
              { role: 'user', content: 'a'.repeat(charCount) },
            ];

            const recommendation = detector.getRoutingRecommendation(messages);
            const estimatedTokens = Math.ceil(charCount / 4);

            if (estimatedTokens < threshold) {
              expect(recommendation.provider).toBe('groq');
            } else {
              expect(recommendation.provider).toBe('gemini');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 35: Groq Context Window Safety', () => {
    it('should never route requests exceeding 8K tokens to Groq', () => {
      // Feature: llm-provider-migration, Property 35: Groq Context Window Safety
      fc.assert(
        fc.property(
          fc.integer({ min: 32001, max: 200000 }), // Char count > 8K tokens
          (charCount) => {
            const detector = new ContentSizeDetector({
              thresholdTokens: 6000,
              groqContextLimit: 8000,
            });

            const messages: Message[] = [
              { role: 'user', content: 'a'.repeat(charCount) },
            ];

            const recommendation = detector.getRoutingRecommendation(messages);
            const estimatedTokens = Math.ceil(charCount / 4);

            // If content exceeds 8K tokens, must route to Gemini
            if (estimatedTokens > 8000) {
              expect(recommendation.provider).toBe('gemini');
              expect(recommendation.reason).toContain('exceeds Groq context limit');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 36: Content Size Routing Logging', () => {
    it('should include estimated token count in routing recommendations', () => {
      // Feature: llm-provider-migration, Property 36: Content Size Routing Logging
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant', 'system'),
              content: fc.string({ minLength: 10, maxLength: 1000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (messages) => {
            const detector = new ContentSizeDetector();
            const recommendation = detector.getRoutingRecommendation(
              messages as Message[]
            );

            // Recommendation must include estimated token count
            expect(recommendation.estimatedTokens).toBeGreaterThanOrEqual(0);
            expect(typeof recommendation.estimatedTokens).toBe('number');

            // Recommendation must include reason
            expect(recommendation.reason).toBeTruthy();
            expect(typeof recommendation.reason).toBe('string');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
