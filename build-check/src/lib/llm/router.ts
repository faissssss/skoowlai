/**
 * LLM Router Module
 *
 * Central abstraction layer that routes LLM requests to the appropriate provider.
 * Integrates rate limiting, queuing, throttling, load balancing, health monitoring,
 * fallback handling, and cost tracking.
 *
 * Uses:
 * - Groq Cloud via OpenAI-compatible API (openai package) for Groq provider
 * - Vercel AI SDK (ai + @ai-sdk/google) for Gemini provider
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1-2.6, 4.1-4.5,
 *            6.1-6.7, 7.1-7.3, 13.1, 13.6, 14.3, 14.4
 */

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { Provider, Priority } from './config';
import type { RateLimitTracker, RateLimitStatus } from './rateLimitTracker';
import type { RequestQueue } from './requestQueue';
import type { ThrottleController } from './throttleController';
import type { LoadBalancer } from './loadBalancer';
import type { HealthMonitor } from './healthMonitor';
import type { FallbackHandler } from './fallbackHandler';
import type { CostTracker } from './costTracker';
import type { RetryStrategy } from './retryStrategy';
import { ContentSizeDetector } from './contentSizeDetector';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ModelMappingEntry {
  provider: Provider;
  model: string;
  priority: Priority;
  /** Force this provider regardless of content size */
  forceProvider?: boolean;
}

export interface LLMRouterConfig {
  primaryProvider: Provider;
  fallbackProvider?: Provider;
  enableFallback: boolean;
  modelMapping: Record<string, ModelMappingEntry>;
  timeout: number;
  /** Optional per-endpoint provider overrides (feature -> provider) */
  endpointOverrides?: Record<string, Provider>;
  /** Enable content-size-based routing */
  enableContentSizeRouting?: boolean;
  /** Token threshold for content-size routing (default: 6000) */
  contentSizeThreshold?: number;
  /** Global migration enabled flag - when false, bypass router and use Gemini */
  migrationEnabled?: boolean;
}

export interface StreamTextParams {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  system?: string;
  feature: string;
  onFinish?: (result: { text: string }) => Promise<void>;
}

export interface StreamTextResult {
  textStream: AsyncIterable<string>;
  text: Promise<string>;
  rateLimitInfo?: RateLimitInfo;
  queuePosition?: number;
  degradedMode?: boolean;
}

export interface GenerateObjectResult<T> {
  object: T;
  rateLimitInfo?: RateLimitInfo;
  queuePosition?: number;
  degradedMode?: boolean;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset: Date;
  percentage: number;
}

export interface GenerateObjectParams<T> {
  schema: z.ZodSchema<T>;
  messages: Message[];
  temperature?: number;
  feature: string;
}

export interface ProviderStatus {
  primary: {
    provider: Provider;
    healthy: boolean;
    rateLimit: RateLimitStatus;
  };
  fallback?: {
    provider: Provider;
    healthy: boolean;
    rateLimit: RateLimitStatus;
  };
  queueDepth: number;
  degradedMode: boolean;
  redisAvailable?: boolean;
  queueDisabled?: boolean;
}

export interface RequestLogEntry {
  requestId: string;
  feature: string;
  provider: Provider;
  model: string;
  startedAt: Date;
  completedAt?: Date;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
  errorCode?: string;
  fallbackUsed: boolean;
  error?: string;
  estimatedTokens?: number;
  contentSizeRoutingReason?: string;
}

/**
 * Sanitize sensitive data from logs.
 * Validates: Requirements 13.7
 */
export function sanitizeLogData(data: string): string {
  let sanitized = data;
  
  // Redact API keys (various formats)
  // Match alphanumeric, underscore, hyphen, plus, slash (base64 chars) of 32+ length
  sanitized = sanitized.replace(/\b[A-Za-z0-9_+/=-]{32,}\b/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/AIza[A-Za-z0-9_-]{35}/g, '[REDACTED_API_KEY]');
  
  // Redact email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
  
  // Redact phone numbers (various formats)
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED_PHONE]');
  sanitized = sanitized.replace(/\b\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g, '[REDACTED_PHONE]');
  
  // Redact credit card numbers
  sanitized = sanitized.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CC]');
  
  // Redact SSN
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  
  // Redact bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9_+/=-]+/gi, 'Bearer [REDACTED_TOKEN]');
  
  return sanitized;
}

export interface LLMRouterDependencies {
  rateLimitTracker?: RateLimitTracker;
  requestQueue?: RequestQueue;
  throttleController?: ThrottleController;
  loadBalancer?: LoadBalancer;
  healthMonitor?: HealthMonitor;
  fallbackHandler?: FallbackHandler;
  costTracker?: CostTracker;
  retryStrategy?: RetryStrategy;
  contentSizeDetector?: ContentSizeDetector;
  /** Injectable clock for testing */
  now?: () => Date;
  /** Injectable logger for testing */
  logger?: (entry: RequestLogEntry) => void;
  /**
   * Injectable stream executor for testing (bypasses real API calls).
   * Receives (provider, model, params) and returns a streaming result.
   */
  streamExecutor?: (
    provider: Provider,
    model: string,
    params: StreamTextParams,
  ) => Promise<StreamTextResult>;
  /**
   * Injectable object executor for testing (bypasses real API calls).
   * Receives (provider, model, params) and returns a generated object.
   */
  objectExecutor?: <T>(
    provider: Provider,
    model: string,
    params: GenerateObjectParams<T>,
  ) => Promise<{ object: T; inputTokens?: number; outputTokens?: number }>;
}

export class ValidationError extends Error {
  constructor(message: string, public readonly issues?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RouterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

export class QueuedError extends Error {
  constructor(
    message: string,
    public readonly queuePosition: number,
    public readonly estimatedWaitMs: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'QueuedError';
  }
}

export class ThrottledError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ThrottledError';
  }
}

export class DegradedModeError extends Error {
  constructor(
    message: string,
    public readonly degradationNotice: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'DegradedModeError';
  }
}

// ─── Default model mapping ────────────────────────────────────────────────────

export const DEFAULT_MODEL_MAPPING: Record<string, ModelMappingEntry> = {
  generate: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high' },
  chat: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high' },
  flashcards: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'medium' },
  quiz: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'medium' },
  mindmap: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'medium' },
  rewrite: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'low' },
  'generate-audio-notes': { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high' },
};

// ─── LLMRouter ────────────────────────────────────────────────────────────────

export class LLMRouter {
  private readonly config: LLMRouterConfig;
  private readonly deps: LLMRouterDependencies;
  private readonly now: () => Date;
  private readonly logger: (entry: RequestLogEntry) => void;
  private readonly logs: RequestLogEntry[] = [];
  private degradedMode: boolean = false;
  private lastDegradedModeCheck: Date | null = null;
  private readonly contentSizeDetector: ContentSizeDetector;

  constructor(config: LLMRouterConfig, deps: LLMRouterDependencies = {}) {
    this.config = config;
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
    this.logger = deps.logger ?? ((entry) => {
      const snapshot: RequestLogEntry = {
        ...entry,
        startedAt: new Date(entry.startedAt),
        completedAt: entry.completedAt ? new Date(entry.completedAt) : undefined,
        error: entry.error ? sanitizeLogData(entry.error) : undefined,
      };

      this.logs.push(snapshot);
    });
    this.contentSizeDetector = deps.contentSizeDetector ?? new ContentSizeDetector({
      enableRouting: config.enableContentSizeRouting ?? true,
      thresholdTokens: config.contentSizeThreshold ?? 6000,
      groqContextLimit: 8000,
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Build rate limit info from rate limit tracker status.
   * Validates: Requirements 20.5, 20.8
   */
  private async getRateLimitInfo(provider: Provider): Promise<RateLimitInfo | undefined> {
    if (!this.deps.rateLimitTracker) {
      return undefined;
    }

    const status = await this.deps.rateLimitTracker.getStatus(provider);
    const peakPercentage = Math.max(status.rpm.percentage, status.rpd.percentage);
    const peakWindow = status.rpm.percentage > status.rpd.percentage ? status.rpm : status.rpd;
    const resetTime = status.rpm.percentage > status.rpd.percentage ? status.resetAt.minute : status.resetAt.day;

    return {
      remaining: peakWindow.remaining,
      limit: peakWindow.limit,
      reset: resetTime,
      percentage: peakPercentage,
    };
  }

  private estimateInputTokens(messages: Message[], systemPrompt?: string, estimatedTokens?: number): number {
    return estimatedTokens ?? this.contentSizeDetector.estimateTokens(messages, systemPrompt);
  }

  private estimateOutputTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async recordCost(entry: {
    requestId: string;
    timestamp: Date;
    provider: Provider;
    model: string;
    feature: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs?: number;
    success: boolean;
    errorCode?: string;
    fallbackUsed: boolean;
  }): Promise<void> {
    if (!this.deps.costTracker) {
      return;
    }

    try {
      await this.deps.costTracker.logRequest(entry);
    } catch (error) {
      console.warn(
        '[LLMRouter] Failed to record cost entry:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async executeProviderCall<T>(
    provider: Provider,
    feature: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const run = async () => {
      if (this.deps.rateLimitTracker) {
        await this.deps.rateLimitTracker.incrementCount(provider);
      }

      return operation();
    };

    if (!this.deps.retryStrategy) {
      return run();
    }

    return this.deps.retryStrategy.execute(run, { feature, provider });
  }

  /**
   * Check if system should be in degraded mode.
   * Degraded mode activates when both providers exceed 90% rate limit.
   * Exits when usage drops below 70%.
   * Validates: Requirements 19.1, 19.6
   */
  private async checkDegradedMode(): Promise<boolean> {
    if (!this.deps.rateLimitTracker) {
      return false;
    }

    // Check rate limits for both providers
    const primaryStatus = await this.deps.rateLimitTracker.getStatus(this.config.primaryProvider);
    const fallbackStatus = this.config.fallbackProvider
      ? await this.deps.rateLimitTracker.getStatus(this.config.fallbackProvider)
      : null;

    const primaryPeak = Math.max(primaryStatus.rpm.percentage, primaryStatus.rpd.percentage);
    const fallbackPeak = fallbackStatus
      ? Math.max(fallbackStatus.rpm.percentage, fallbackStatus.rpd.percentage)
      : 0;

    // Enter degraded mode when both providers exceed 90%
    if (primaryPeak >= 90 && (!fallbackStatus || fallbackPeak >= 90)) {
      if (!this.degradedMode) {
        this.degradedMode = true;
        this.logDegradedModeTransition(true, primaryPeak, fallbackPeak);
      }
      return true;
    }

    // Exit degraded mode when usage drops below 70%
    if (this.degradedMode && primaryPeak < 70 && (!fallbackStatus || fallbackPeak < 70)) {
      this.degradedMode = false;
      this.logDegradedModeTransition(false, primaryPeak, fallbackPeak);
      return false;
    }

    return this.degradedMode;
  }

  /**
   * Log degraded mode transitions.
   * Validates: Requirements 19.7, 19.8
   */
  private logDegradedModeTransition(entering: boolean, primaryPeak: number, fallbackPeak: number): void {
    const message = entering
      ? `Entering degraded mode: primary=${primaryPeak.toFixed(1)}%, fallback=${fallbackPeak.toFixed(1)}%`
      : `Exiting degraded mode: primary=${primaryPeak.toFixed(1)}%, fallback=${fallbackPeak.toFixed(1)}%`;

    console.log(`[LLMRouter] ${message}`);

    // Notify monitoring systems when entering degraded mode
    if (entering && this.deps.healthMonitor) {
      // Health monitor can be extended to handle degraded mode notifications
    }
  }

  /**
   * Apply degraded mode restrictions to request parameters.
   * Validates: Requirements 19.3, 19.4
   */
  private applyDegradedModeRestrictions(
    model: string,
    maxTokens: number | undefined,
  ): { model: string; maxTokens: number | undefined } {
    // Switch to smaller models (Llama 3.1 8B instead of 3.3 70B)
    let degradedModel = model;
    if (model === 'llama-3.3-70b-versatile') {
      degradedModel = 'llama-3.1-8b-instant';
    } else if (model.startsWith('gemini-')) {
      // Gemini doesn't have a smaller model, keep the same
      degradedModel = model;
    }

    // Reduce token limits by 50%
    const degradedMaxTokens = maxTokens ? Math.floor(maxTokens * 0.5) : undefined;

    return { model: degradedModel, maxTokens: degradedMaxTokens };
  }

  /**
   * Stream text from the configured provider for the given feature.
   * Validates: Requirements 1.1, 1.3, 2.4, 2.5, 7.1, 7.2, 7.3, 13.1, 13.6, 14.3, 19.1-19.8, 23.2, 23.3, 23.6
   */
  async streamText(params: StreamTextParams): Promise<StreamTextResult> {
    const requestId = randomUUID();
    const startedAt = this.now();

    // Check degraded mode
    const inDegradedMode = await this.checkDegradedMode();

    // Reject low priority features in degraded mode (Requirement 19.2)
    if (inDegradedMode && (params.feature === 'rewrite' || params.feature === 'batch')) {
      throw new RouterError(
        'Service temporarily degraded: low priority features are disabled',
        'DEGRADED_MODE_FEATURE_DISABLED',
        requestId,
      );
    }

    // Resolve provider with content-size routing (Requirements 23.2, 23.3, 23.6)
    const resolution = this.resolveProviderAndModel(
      params.feature,
      params.messages,
      params.system
    );
    const { provider, estimatedTokens, routingReason } = resolution;
    let { model } = resolution;
    let effectiveMaxTokens = params.maxTokens;

    // Apply degraded mode restrictions (Requirements 19.3, 19.4)
    if (inDegradedMode) {
      const restricted = this.applyDegradedModeRestrictions(model, effectiveMaxTokens);
      model = restricted.model;
      effectiveMaxTokens = restricted.maxTokens;
    }

    const logEntry: RequestLogEntry = {
      requestId,
      feature: params.feature,
      provider,
      model,
      startedAt,
      success: false,
      fallbackUsed: false,
      estimatedTokens,
      contentSizeRoutingReason: routingReason,
    };

    const executeStream = async (
      targetProvider: Provider,
      targetModel: string,
    ): Promise<StreamTextResult> => {
      try {
        const requestParams = {
          ...params,
          maxTokens: effectiveMaxTokens,
        };

        const result = await this.executeProviderCall(targetProvider, params.feature, async () => {
          if (this.deps.streamExecutor) {
            return this.deps.streamExecutor(targetProvider, targetModel, requestParams);
          }

          if (inDegradedMode) {
            const fullText = await this.callProviderNonStreaming(
              targetProvider,
              targetModel,
              requestParams,
              requestId,
            );

            async function* singleYield() {
              yield fullText;
            }

            return {
              textStream: singleYield(),
              text: Promise.resolve(fullText),
            };
          }

          return this.callProviderStream(
            targetProvider,
            targetModel,
            requestParams,
            requestId,
          );
        });

        // Wrap the text promise to log on completion
        const wrappedText = result.text.then(async (text) => {
          const completedAt = this.now();
          logEntry.completedAt = completedAt;
          logEntry.latencyMs = completedAt.getTime() - startedAt.getTime();
          logEntry.inputTokens = this.estimateInputTokens(params.messages, params.system, estimatedTokens);
          logEntry.outputTokens = this.estimateOutputTokens(text);
          logEntry.success = true;

          if (params.onFinish) {
            try {
              await params.onFinish({ text });
            } catch (onFinishError) {
              console.error(
                '[LLMRouter] onFinish callback failed:',
                onFinishError instanceof Error ? onFinishError.message : String(onFinishError),
              );
            }
          }

          this.logger(logEntry);
          await this.recordCost({
            requestId,
            timestamp: startedAt,
            provider: targetProvider,
            model: targetModel,
            feature: params.feature,
            inputTokens: logEntry.inputTokens,
            outputTokens: logEntry.outputTokens,
            latencyMs: logEntry.latencyMs,
            success: true,
            fallbackUsed: logEntry.fallbackUsed,
          });
          return text;
        }).catch((error) => {
          const completedAt = this.now();
          logEntry.completedAt = completedAt;
          logEntry.latencyMs = completedAt.getTime() - startedAt.getTime();
          logEntry.success = false;
          logEntry.errorCode = this.classifyError(error);
          logEntry.error = error instanceof Error ? error.message : String(error);
          this.logger(logEntry);
          throw error;
        });

        // Get rate limit info for response headers
        const rateLimitInfo = await this.getRateLimitInfo(targetProvider);

        return {
          textStream: result.textStream,
          text: wrappedText,
          rateLimitInfo,
          degradedMode: inDegradedMode,
        };
      } catch (error) {
        const completedAt = this.now();
        logEntry.completedAt = completedAt;
        logEntry.latencyMs = completedAt.getTime() - startedAt.getTime();
        logEntry.success = false;
        logEntry.errorCode = this.classifyError(error);
        logEntry.error = error instanceof Error ? error.message : String(error);
        this.logger(logEntry);
        throw error;
      }
    };

    try {
      if (this.config.enableFallback && this.deps.fallbackHandler && this.config.fallbackProvider) {
        const fallbackProvider = this.config.fallbackProvider;
        const fallbackModel = this.getModelForProvider(fallbackProvider, params.feature);

        return await this.deps.fallbackHandler.executeWithFallback(
          () => executeStream(provider, model),
          () => {
            logEntry.fallbackUsed = true;
            logEntry.provider = fallbackProvider;
            logEntry.model = fallbackModel;
            return executeStream(fallbackProvider, fallbackModel);
          },
          {
            feature: params.feature,
            primaryProvider: provider,
            fallbackProvider,
          },
        );
      }

      return await executeStream(provider, model);
    } catch (error) {
      await this.recordCost({
        requestId,
        timestamp: startedAt,
        provider: logEntry.provider,
        model: logEntry.model,
        feature: params.feature,
        inputTokens: this.estimateInputTokens(params.messages, params.system, estimatedTokens),
        outputTokens: 0,
        latencyMs: logEntry.latencyMs,
        success: false,
        errorCode: logEntry.errorCode,
        fallbackUsed: logEntry.fallbackUsed,
      });
      throw error;
    }
  }

  /**
   * Generate a structured object validated against a Zod schema.
   * Validates: Requirements 1.2, 2.6, 6.1-6.7, 13.1, 13.6, 14.3, 19.1-19.8, 23.2, 23.3, 23.6
   */
  async generateObject<T>(params: GenerateObjectParams<T>): Promise<GenerateObjectResult<T>> {
    const requestId = randomUUID();
    const startedAt = this.now();

    // Check degraded mode
    const inDegradedMode = await this.checkDegradedMode();

    // Reject low priority features in degraded mode (Requirement 19.2)
    if (inDegradedMode && (params.feature === 'rewrite' || params.feature === 'batch')) {
      throw new RouterError(
        'Service temporarily degraded: low priority features are disabled',
        'DEGRADED_MODE_FEATURE_DISABLED',
        requestId,
      );
    }

    // Resolve provider with content-size routing (Requirements 23.2, 23.3, 23.6)
    const resolution = this.resolveProviderAndModel(params.feature, params.messages);
    const { provider, estimatedTokens, routingReason } = resolution;
    let { model } = resolution;

    // Apply degraded mode restrictions (Requirements 19.3, 19.4)
    // Note: generateObject doesn't have maxTokens in params, but we still switch to smaller models
    if (inDegradedMode) {
      const restricted = this.applyDegradedModeRestrictions(model, undefined);
      model = restricted.model;
    }

    const logEntry: RequestLogEntry = {
      requestId,
      feature: params.feature,
      provider,
      model,
      startedAt,
      success: false,
      fallbackUsed: false,
      estimatedTokens,
      contentSizeRoutingReason: routingReason,
    };

    const executeGenerate = async (
      targetProvider: Provider,
      targetModel: string,
    ): Promise<GenerateObjectResult<T>> => {
      const maxValidationRetries = 2;

      for (let attempt = 0; attempt <= maxValidationRetries; attempt++) {
        try {
          const result = await this.executeProviderCall(targetProvider, params.feature, async () => {
            if (this.deps.objectExecutor) {
              return this.deps.objectExecutor<T>(targetProvider, targetModel, params);
            }

            return this.callProviderObject<T>(
              targetProvider,
              targetModel,
              params,
              requestId,
            );
          });
          const { object: rawObject, inputTokens, outputTokens } = result;

          // Validate against schema (Requirement 6.3)
          const parsed = params.schema.safeParse(rawObject);
          if (!parsed.success) {
            if (attempt < maxValidationRetries) {
              // Retry on validation failure (Requirement 6.4)
              continue;
            }
            throw new ValidationError(
              `Structured output validation failed after ${maxValidationRetries + 1} attempts`,
              parsed.error.issues,
            );
          }

          const completedAt = this.now();
          logEntry.completedAt = completedAt;
          logEntry.latencyMs = completedAt.getTime() - startedAt.getTime();
          logEntry.inputTokens = inputTokens ?? this.estimateInputTokens(params.messages, undefined, estimatedTokens);
          logEntry.outputTokens = outputTokens ?? this.estimateOutputTokens(JSON.stringify(parsed.data));
          logEntry.success = true;
          this.logger(logEntry);

          await this.recordCost({
            requestId,
            timestamp: startedAt,
            provider: targetProvider,
            model: targetModel,
            feature: params.feature,
            inputTokens: logEntry.inputTokens,
            outputTokens: logEntry.outputTokens,
            latencyMs: logEntry.latencyMs,
            success: true,
            fallbackUsed: logEntry.fallbackUsed,
          });

          // Get rate limit info for response headers
          const rateLimitInfo = await this.getRateLimitInfo(targetProvider);

          return { 
            object: parsed.data,
            rateLimitInfo,
            degradedMode: inDegradedMode,
          };
        } catch (error) {
          if (error instanceof ValidationError) {
            throw error;
          }

          // Handle malformed JSON gracefully (Requirement 6.7)
          if (this.isMalformedJsonError(error)) {
            if (attempt < maxValidationRetries) {
              continue;
            }
            const completedAt = this.now();
            logEntry.completedAt = completedAt;
            logEntry.latencyMs = completedAt.getTime() - startedAt.getTime();
            logEntry.success = false;
            logEntry.errorCode = 'MALFORMED_JSON';
            logEntry.error = error instanceof Error ? error.message : String(error);
            this.logger(logEntry);
            throw new ValidationError(
              'Malformed JSON in structured output response',
              { originalError: error instanceof Error ? error.message : String(error) },
            );
          }

          const completedAt = this.now();
          logEntry.completedAt = completedAt;
          logEntry.latencyMs = completedAt.getTime() - startedAt.getTime();
          logEntry.success = false;
          logEntry.errorCode = this.classifyError(error);
          logEntry.error = error instanceof Error ? error.message : String(error);
          this.logger(logEntry);
          throw error;
        }
      }

      // Should never reach here
      throw new ValidationError('Structured output validation failed after retries');
    };

    try {
      if (this.config.enableFallback && this.deps.fallbackHandler && this.config.fallbackProvider) {
        const fallbackProvider = this.config.fallbackProvider;
        const fallbackModel = this.getModelForProvider(fallbackProvider, params.feature);

        return await this.deps.fallbackHandler.executeWithFallback(
          () => executeGenerate(provider, model),
          () => {
            logEntry.fallbackUsed = true;
            logEntry.provider = fallbackProvider;
            logEntry.model = fallbackModel;
            return executeGenerate(fallbackProvider, fallbackModel);
          },
          {
            feature: params.feature,
            primaryProvider: provider,
            fallbackProvider,
          },
        );
      }

      return await executeGenerate(provider, model);
    } catch (error) {
      await this.recordCost({
        requestId,
        timestamp: startedAt,
        provider: logEntry.provider,
        model: logEntry.model,
        feature: params.feature,
        inputTokens: this.estimateInputTokens(params.messages, undefined, estimatedTokens),
        outputTokens: 0,
        latencyMs: logEntry.latencyMs,
        success: false,
        errorCode: logEntry.errorCode,
        fallbackUsed: logEntry.fallbackUsed,
      });
      throw error;
    }
  }

  /**
   * Get current provider status.
   */
  async getProviderStatus(): Promise<ProviderStatus> {
    const primaryHealth = this.deps.healthMonitor
      ? await this.deps.healthMonitor.getHealth(this.config.primaryProvider)
      : { healthy: true };

    const primaryRateLimit = this.deps.rateLimitTracker
      ? await this.deps.rateLimitTracker.getStatus(this.config.primaryProvider)
      : {
          provider: this.config.primaryProvider,
          rpm: { current: 0, limit: 0, remaining: 0, percentage: 0 },
          rpd: { current: 0, limit: 0, remaining: 0, percentage: 0 },
          resetAt: { minute: new Date(), day: new Date() },
          warningThresholdExceeded: false,
          throttleThresholdExceeded: false,
          shouldQueue: false,
          shouldThrottle: false,
          isExceeded: false,
        };

    // Check if Redis is available by attempting to get queue status
    let queueStatus = null;
    let redisAvailable = true;
    let queueDisabled = false;
    
    if (this.deps.requestQueue) {
      try {
        queueStatus = await this.deps.requestQueue.getStatus();
      } catch (error) {
        // Redis unavailable - queue is disabled
        redisAvailable = false;
        queueDisabled = true;
        console.warn(
          '[LLMRouter] Request queue unavailable due to Redis failure. ' +
          'Queuing is disabled - requests will be processed immediately. ' +
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      queueDisabled = true;
    }

    // Check degraded mode status
    const degradedMode = await this.checkDegradedMode();

    const status: ProviderStatus = {
      primary: {
        provider: this.config.primaryProvider,
        healthy: primaryHealth.healthy,
        rateLimit: primaryRateLimit,
      },
      queueDepth: queueStatus?.depth ?? 0,
      degradedMode,
      redisAvailable,
      queueDisabled,
    };

    if (this.config.fallbackProvider) {
      const fallbackHealth = this.deps.healthMonitor
        ? await this.deps.healthMonitor.getHealth(this.config.fallbackProvider)
        : { healthy: true };
        
      const fallbackRateLimit = this.deps.rateLimitTracker
        ? await this.deps.rateLimitTracker.getStatus(this.config.fallbackProvider)
        : {
            provider: this.config.fallbackProvider,
            rpm: { current: 0, limit: 0, remaining: 0, percentage: 0 },
            rpd: { current: 0, limit: 0, remaining: 0, percentage: 0 },
            resetAt: { minute: new Date(), day: new Date() },
            warningThresholdExceeded: false,
            throttleThresholdExceeded: false,
            shouldQueue: false,
            shouldThrottle: false,
            isExceeded: false,
          };

      status.fallback = {
        provider: this.config.fallbackProvider,
        healthy: fallbackHealth.healthy,
        rateLimit: fallbackRateLimit,
      };
    }

    return status;
  }

  /**
   * Create a new router instance with a specific provider override.
   * Validates: Requirements 12.1, 12.2
   */
  withProvider(provider: Provider): LLMRouter {
    const overrides: Record<string, Provider> = {};
    for (const feature of Object.keys(this.config.modelMapping)) {
      overrides[feature] = provider;
    }
    return new LLMRouter(
      {
        ...this.config,
        endpointOverrides: {
          ...this.config.endpointOverrides,
          ...overrides,
        },
      },
      this.deps,
    );
  }

  /**
   * Get all logged request entries (for testing/inspection).
   */
  getLogs(): RequestLogEntry[] {
    return this.logs.map((entry) => ({
      ...entry,
      startedAt: new Date(entry.startedAt),
      completedAt: entry.completedAt ? new Date(entry.completedAt) : undefined,
    }));
  }

  // ── Provider resolution ─────────────────────────────────────────────────────

  /**
   * Resolve the provider and model for a given feature, respecting overrides.
   * Validates: Requirements 1.4, 2.3, 12.1, 12.2, 12.6
   */
  resolveProviderAndModel(
    feature: string,
    messages?: Message[],
    systemPrompt?: string
  ): { provider: Provider; model: string; estimatedTokens?: number; routingReason?: string } {
    // Check global migration enabled flag first (Requirement 12.7)
    // When false, bypass router and use Gemini directly
    if (this.config.migrationEnabled === false) {
      console.log(`[LLM Router] Global rollback active: routing ${feature} to Gemini`);
      return {
        provider: 'gemini',
        model: this.getModelForProvider('gemini', feature),
        routingReason: 'Global migration rollback (LLM_MIGRATION_ENABLED=false)',
      };
    }

    // Check per-endpoint override (Requirement 12.1)
    const overrideProvider = this.config.endpointOverrides?.[feature];
    if (overrideProvider) {
      console.log(`[LLM Router] Endpoint override active: routing ${feature} to ${overrideProvider}`);
      return {
        provider: overrideProvider,
        model: this.getModelForProvider(overrideProvider, feature),
        routingReason: `Endpoint override to ${overrideProvider}`,
      };
    }

    // Check if feature has forceProvider flag in model mapping
    const mapping = this.config.modelMapping[feature];
    if (mapping?.forceProvider) {
      return {
        provider: mapping.provider,
        model: mapping.model,
        routingReason: `Feature ${feature} forced to ${mapping.provider}`,
      };
    }

    // Apply content-size-based routing if enabled and messages provided
    if (messages && this.config.enableContentSizeRouting !== false) {
      const recommendation = this.contentSizeDetector.getRoutingRecommendation(
        messages,
        systemPrompt
      );

      return {
        provider: recommendation.provider,
        model: this.getModelForProvider(recommendation.provider, feature),
        estimatedTokens: recommendation.estimatedTokens,
        routingReason: recommendation.reason,
      };
    }

    // Use model mapping
    if (mapping) {
      return {
        provider: mapping.provider,
        model: mapping.model,
        routingReason: `Model mapping for ${feature}`,
      };
    }

    // Fall back to primary provider with default model
    return {
      provider: this.config.primaryProvider,
      model: this.getDefaultModelForProvider(this.config.primaryProvider),
      routingReason: `Default primary provider`,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Get the model name for a provider and feature combination.
   */
  private getModelForProvider(provider: Provider, feature: string): string {
    // Check if there's a mapping for this feature with this provider
    const mapping = this.config.modelMapping[feature];
    if (mapping && mapping.provider === provider) {
      return mapping.model;
    }

    // Use default model for the provider
    return this.getDefaultModelForProvider(provider);
  }

  /**
   * Get the default model for a provider.
   */
  private getDefaultModelForProvider(provider: Provider): string {
    if (provider === 'groq') {
      return 'llama-3.3-70b-versatile';
    }
    return 'gemini-2.5-flash';
  }

  /**
   * Call the provider's API without streaming (for degraded mode).
   * Validates: Requirements 19.5
   */
  private async callProviderNonStreaming(
    provider: Provider,
    model: string,
    params: StreamTextParams,
    requestId: string,
  ): Promise<string> {
    void requestId;
    const timeoutMs = this.config.timeout;

    if (provider === 'groq') {
      return this.callGroqNonStreaming(model, params, timeoutMs);
    }

    return this.callGeminiNonStreaming(model, params, timeoutMs);
  }

  /**
   * Call Groq's API without streaming.
   */
  private async callGroqNonStreaming(
    model: string,
    params: StreamTextParams,
    timeoutMs: number,
  ): Promise<string> {
    const { default: OpenAI } = await import('openai');

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

    if (params.system) {
      messages.push({ role: 'system', content: params.system });
    }

    for (const msg of params.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await client.chat.completions.create(
        {
          model,
          messages,
          stream: false,
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
          ...(params.maxTokens !== undefined ? { max_tokens: params.maxTokens } : {}),
        },
        { signal: controller.signal },
      );

      clearTimeout(timeoutHandle);

      return response.choices[0]?.message?.content ?? '';
    } catch (error) {
      clearTimeout(timeoutHandle);
      throw error;
    }
  }

  /**
   * Call Gemini's API without streaming.
   */
  private async callGeminiNonStreaming(
    model: string,
    params: StreamTextParams,
    timeoutMs: number,
  ): Promise<string> {
    const { generateText } = await import('ai');
    const { google } = await import('@ai-sdk/google');

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await generateText({
        model: google(model as Parameters<typeof google>[0]),
        messages: params.messages,
        ...(params.system ? { system: params.system } : {}),
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(params.maxTokens !== undefined ? { maxTokens: params.maxTokens } : {}),
        abortSignal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      return result.text;
    } catch (error) {
      clearTimeout(timeoutHandle);
      throw error;
    }
  }

  /**
   * Call the provider's streaming API.
   * Uses OpenAI-compatible API for Groq, Vercel AI SDK for Gemini.
   * Validates: Requirements 2.3, 2.4, 2.5, 7.1, 7.2, 7.3
   */
  private async callProviderStream(
    provider: Provider,
    model: string,
    params: StreamTextParams,
    requestId: string,
  ): Promise<StreamTextResult> {
    void requestId;
    const timeoutMs = this.config.timeout;

    if (provider === 'groq') {
      return this.callGroqStream(model, params, timeoutMs);
    }

    return this.callGeminiStream(model, params, timeoutMs);
  }

  /**
   * Call Groq's OpenAI-compatible streaming API.
   * Validates: Requirements 2.3, 2.4, 2.5
   */
  private async callGroqStream(
    model: string,
    params: StreamTextParams,
    timeoutMs: number,
  ): Promise<StreamTextResult> {
    // Dynamic import to avoid loading at module level
    const { default: OpenAI } = await import('openai');

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

    if (params.system) {
      messages.push({ role: 'system', content: params.system });
    }

    for (const msg of params.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    const stream = await client.chat.completions.create(
      {
        model,
        messages,
        stream: true,
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(params.maxTokens !== undefined ? { max_tokens: params.maxTokens } : {}),
      },
      { signal: controller.signal },
    );

    clearTimeout(timeoutHandle);

    // Groq's stream can only be consumed once. Fan out from a single reader so
    // callers can safely use both `textStream` and `text`.
    const parts: string[] = [];
    const bufferedTokens: string[] = [];
    let pendingResolve: null | (() => void) = null;
    let streamDone = false;
    let streamError: unknown = null;

    const textPromise = (async () => {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (!delta) continue;

          parts.push(delta);
          bufferedTokens.push(delta);

          if (pendingResolve) {
            const resolver: () => void = pendingResolve;
            pendingResolve = null;
            resolver();
          }
        }

        streamDone = true;
        if (pendingResolve) {
          const resolver: () => void = pendingResolve;
          pendingResolve = null;
          resolver();
        }

        return parts.join('');
      } catch (error) {
        streamError = error;
        streamDone = true;
        if (pendingResolve) {
          const resolver: () => void = pendingResolve;
          pendingResolve = null;
          resolver();
        }
        throw error;
      }
    })();

    async function* tokenStream(): AsyncIterable<string> {
      while (true) {
        if (bufferedTokens.length > 0) {
          yield bufferedTokens.shift()!;
          continue;
        }

        if (streamError) {
          throw streamError;
        }

        if (streamDone) {
          break;
        }

        await new Promise<void>((resolve) => {
          pendingResolve = resolve;
        });
      }
    }

    return {
      textStream: tokenStream(),
      text: textPromise,
    };
  }

  /**
   * Call Gemini's streaming API via Vercel AI SDK.
   * Validates: Requirements 7.2
   */
  private async callGeminiStream(
    model: string,
    params: StreamTextParams,
    timeoutMs: number,
  ): Promise<StreamTextResult> {
    const { streamText: aiStreamText } = await import('ai');
    const { google } = await import('@ai-sdk/google');

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await aiStreamText({
        model: google(model as Parameters<typeof google>[0]),
        messages: params.messages,
        ...(params.system ? { system: params.system } : {}),
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(params.maxTokens !== undefined ? { maxTokens: params.maxTokens } : {}),
        abortSignal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      return {
        textStream: result.textStream,
        text: result.text,
      };
    } catch (error) {
      clearTimeout(timeoutHandle);
      throw error;
    }
  }

  /**
   * Call the provider's object generation API.
   * Validates: Requirements 2.6, 6.1, 6.2
   */
  private async callProviderObject<T>(
    provider: Provider,
    model: string,
    params: GenerateObjectParams<T>,
    requestId: string,
  ): Promise<{ object: T; inputTokens?: number; outputTokens?: number }> {
    void requestId;
    const timeoutMs = this.config.timeout;

    if (provider === 'groq') {
      return this.callGroqObject<T>(model, params, timeoutMs);
    }

    return this.callGeminiObject<T>(model, params, timeoutMs);
  }

  /**
   * Call Groq's OpenAI-compatible API for structured output (JSON mode).
   * Validates: Requirements 2.4, 2.6, 6.1, 6.2
   */
  private async callGroqObject<T>(
    model: string,
    params: GenerateObjectParams<T>,
    timeoutMs: number,
  ): Promise<{ object: T; inputTokens?: number; outputTokens?: number }> {
    const { default: OpenAI } = await import('openai');

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

    for (const msg of params.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add JSON mode instruction
    const lastUserMsg = messages.slice().reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      lastUserMsg.content += '\n\nRespond with valid JSON only.';
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await client.chat.completions.create(
        {
          model,
          messages,
          response_format: { type: 'json_object' },
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        },
        { signal: controller.signal },
      );

      clearTimeout(timeoutHandle);

      const content = response.choices[0]?.message?.content ?? '';

      // Parse JSON (Requirement 6.2)
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        throw new SyntaxError(
          `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }

      return {
        object: parsed as T,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      };
    } catch (error) {
      clearTimeout(timeoutHandle);
      throw error;
    }
  }

  /**
   * Call Gemini's API for structured output via Vercel AI SDK.
   * Validates: Requirements 6.1
   */
  private async callGeminiObject<T>(
    model: string,
    params: GenerateObjectParams<T>,
    timeoutMs: number,
  ): Promise<{ object: T; inputTokens?: number; outputTokens?: number }> {
    const { generateObject: aiGenerateObject } = await import('ai');
    const { google } = await import('@ai-sdk/google');

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (aiGenerateObject as any)({
        model: google(model as Parameters<typeof google>[0]),
        schema: params.schema,
        messages: params.messages,
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        abortSignal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      return {
        object: result.object as T,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      };
    } catch (error) {
      clearTimeout(timeoutHandle);
      throw error;
    }
  }

  /**
   * Classify an error into a short code for logging.
   */
  private classifyError(error: unknown): string {
    if (!(error instanceof Error)) return 'UNKNOWN';

    const err = error as Error & {
      statusCode?: number;
      status?: number;
      response?: { status?: number };
      code?: string;
    };

    const status = err.statusCode ?? err.status ?? err.response?.status;
    if (status === 429) return 'RATE_LIMIT';
    if (status !== undefined && status >= 500) return 'PROVIDER_ERROR';
    if (status !== undefined && status >= 400) return 'CLIENT_ERROR';
    if (err.name === 'AbortError' || err.code === 'ETIMEDOUT' || /timeout/i.test(err.message)) {
      return 'TIMEOUT';
    }
    return 'UNKNOWN';
  }

  /**
   * Check if an error is due to malformed JSON in the response.
   */
  private isMalformedJsonError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return (
      error.name === 'SyntaxError' ||
      /json/i.test(error.message) ||
      /parse/i.test(error.message) ||
      /unexpected token/i.test(error.message)
    );
  }
}
