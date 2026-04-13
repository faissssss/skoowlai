/**
 * Content Size Detector
 * 
 * Estimates token count from input content to enable intelligent routing
 * based on content size. Routes small content to Groq (cost-effective) and
 * large content to Gemini (large context windows).
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ContentSizeConfig {
  thresholdTokens: number; // Default: 6000
  groqContextLimit: number; // Default: 8000
  enableRouting: boolean; // Default: true
}

export interface RoutingRecommendation {
  provider: 'groq' | 'gemini';
  estimatedTokens: number;
  reason: string;
}

export class ContentSizeDetector {
  private config: ContentSizeConfig;

  constructor(config?: Partial<ContentSizeConfig>) {
    this.config = {
      thresholdTokens: config?.thresholdTokens ?? 6000,
      groqContextLimit: config?.groqContextLimit ?? 8000,
      enableRouting: config?.enableRouting ?? true,
    };
  }

  /**
   * Estimate token count from text using character count / 4 heuristic
   * This is a rough approximation commonly used for English text
   */
  estimateTokens(messages: Message[], systemPrompt?: string): number {
    let totalChars = 0;

    // Count characters from all messages
    for (const message of messages) {
      totalChars += message.content.length;
    }

    // Add system prompt if provided
    if (systemPrompt) {
      totalChars += systemPrompt.length;
    }

    // Use character count / 4 as token estimation heuristic
    return Math.ceil(totalChars / 4);
  }

  /**
   * Get routing recommendation based on estimated token count
   */
  getRoutingRecommendation(
    messages: Message[],
    systemPrompt?: string,
    forceProvider?: 'groq' | 'gemini'
  ): RoutingRecommendation {
    // If routing is disabled, default to groq
    if (!this.config.enableRouting) {
      return {
        provider: 'groq',
        estimatedTokens: 0,
        reason: 'Content size routing disabled',
      };
    }

    // If provider is forced, respect that
    if (forceProvider) {
      const estimatedTokens = this.estimateTokens(messages, systemPrompt);
      return {
        provider: forceProvider,
        estimatedTokens,
        reason: `Provider forced to ${forceProvider}`,
      };
    }

    const estimatedTokens = this.estimateTokens(messages, systemPrompt);

    // Safety check: if content exceeds Groq's context limit, must use Gemini
    if (estimatedTokens > this.config.groqContextLimit) {
      return {
        provider: 'gemini',
        estimatedTokens,
        reason: `Content exceeds Groq context limit (${estimatedTokens} > ${this.config.groqContextLimit} tokens)`,
      };
    }

    // Route based on threshold
    if (estimatedTokens < this.config.thresholdTokens) {
      return {
        provider: 'groq',
        estimatedTokens,
        reason: `Content below threshold (${estimatedTokens} < ${this.config.thresholdTokens} tokens)`,
      };
    } else {
      return {
        provider: 'gemini',
        estimatedTokens,
        reason: `Content above threshold (${estimatedTokens} >= ${this.config.thresholdTokens} tokens)`,
      };
    }
  }

  /**
   * Check if content exceeds a provider's context limit
   */
  exceedsProviderLimit(
    messages: Message[],
    provider: 'groq' | 'gemini',
    systemPrompt?: string
  ): boolean {
    const estimatedTokens = this.estimateTokens(messages, systemPrompt);

    if (provider === 'groq') {
      return estimatedTokens > this.config.groqContextLimit;
    }

    // Gemini has much larger context window (1M+ tokens), unlikely to exceed
    return false;
  }

  /**
   * Get current configuration
   */
  getConfig(): ContentSizeConfig {
    return { ...this.config };
  }
}
