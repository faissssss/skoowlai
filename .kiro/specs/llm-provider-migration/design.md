# Design Document: LLM Provider Migration

## Overview

This design document outlines the architecture for migrating the application's LLM infrastructure from Google Gemini API to a hybrid approach that leverages Groq Cloud's free tier as the primary provider with intelligent fallback to Gemini.


### Current State

The application currently uses:
- **Gemini 2.5 Flash** for 7 endpoints: note generation (`/api/generate`), chat (`/api/chat`), flashcards (`/api/flashcards`), quiz (`/api/quiz`), mindmap (`/api/mindmap`), rewrite (`/api/rewrite`), and audio note generation (`/api/generate-audio-notes`)
- **Groq Whisper** for 2 endpoints: voice transcription (`/api/voice-transcribe`) and audio file transcription (within `/api/generate`)
- **Vercel AI SDK** (`ai` package) for streaming and structured output generation
- **Direct API calls** to both providers with provider-specific code in each endpoint

### Target State

The new architecture will provide:
- **Unified LLM Router** abstraction layer for all LLM requests
- **Groq Cloud** (Llama 3.3 70B, Llama 3.1 8B) as primary provider
- **Gemini API** as fallback provider for reliability
- **Intelligent rate limit management** with Redis-backed tracking
- **Request queuing and prioritization** for traffic spike handling
- **Load balancing** across providers based on capacity
- **Graceful degradation** when rate limits are approached
- **Comprehensive monitoring** for cost tracking and health checks

### Design Goals

1. **Cost Reduction**: Maximize usage of Groq Cloud's free tier (14,400 req/day, 30 req/min)
2. **Reliability**: Maintain service availability through fallback and queuing mechanisms
3. **Performance**: Preserve or improve response times with intelligent routing
4. **Maintainability**: Provide clean abstraction that simplifies endpoint code
5. **Observability**: Enable comprehensive monitoring of provider health and costs
6. **Safety**: Support incremental migration with per-endpoint rollback capability

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "API Endpoints"
        E1[/api/generate]
        E2[/api/chat]
        E3[/api/flashcards]
        E4[/api/quiz]
        E5[/api/mindmap]
        E6[/api/rewrite]
        E7[/api/generate-audio-notes]
    end
    
    subgraph "LLM Router Layer"
        Router[LLM Router]
        Config[Provider Config]
        Mapping[Model Mapping]
    end
    
    subgraph "Request Management"
        Queue[Request Queue]
        Priority[Priority Manager]
        Throttle[Throttle Controller]
    end
    
    subgraph "Provider Management"
        RateLimit[Rate Limit Tracker]
        LoadBalancer[Load Balancer]
        Health[Health Monitor]
        Fallback[Fallback Handler]
    end
    
    subgraph "Providers"
        Groq[Groq Cloud<br/>Llama 3.3 70B<br/>Llama 3.1 8B]
        Gemini[Gemini API<br/>Gemini 2.5 Flash]
    end
    
    subgraph "Infrastructure"
        Redis[(Redis<br/>Rate Limits<br/>Queue State)]
        Metrics[(Metrics Store<br/>Cost Tracking<br/>Health Data)]
    end
    
    E1 & E2 & E3 & E4 & E5 & E6 & E7 --> Router
    Router --> Config
    Router --> Mapping
    Router --> Queue
    Queue --> Priority
    Queue --> Throttle
    Router --> RateLimit
    Router --> LoadBalancer
    Router --> Health
    Router --> Fallback
    
    LoadBalancer --> Groq
    LoadBalancer --> Gemini
    Fallback --> Gemini
    
    RateLimit --> Redis
    Queue --> Redis
    Health --> Metrics
    RateLimit --> Metrics
    LoadBalancer --> Metrics
```

### Component Architecture

The system is organized into four primary layers:

1. **API Endpoint Layer**: Existing Next.js API routes that handle user requests
2. **LLM Router Layer**: Abstraction that provides unified interface for LLM operations
3. **Request Management Layer**: Handles queuing, prioritization, and throttling
4. **Provider Management Layer**: Manages provider selection, rate limits, health, and fallback


## Components and Interfaces

### 1. LLM Router

The central abstraction layer that provides a unified interface for all LLM operations.

**Responsibilities:**
- Route requests to appropriate providers based on configuration
- Handle streaming and structured output requests uniformly
- Coordinate with rate limit tracker and load balancer
- Execute fallback logic when primary provider fails
- Log all requests for monitoring and debugging

**Interface:**

```typescript
interface LLMRouterConfig {
  primaryProvider: 'groq' | 'gemini';
  fallbackProvider?: 'groq' | 'gemini';
  enableFallback: boolean;
  modelMapping: ModelMapping;
  timeout: number;
  retryStrategy: RetryConfig;
  contentSizeRouting: {
    enabled: boolean;
    thresholdTokens: number;
  };
}

interface ModelMapping {
  [feature: string]: {
    provider: 'groq' | 'gemini';
    model: string;
    priority: 'high' | 'medium' | 'low';
    forceProvider?: boolean; // If true, bypass content-size routing
  };
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  jitterMs: number;
}

class LLMRouter {
  constructor(config: LLMRouterConfig);
  
  async streamText(params: StreamTextParams): Promise<StreamTextResult>;
  async generateObject<T>(params: GenerateObjectParams<T>): Promise<GenerateObjectResult<T>>;
  getProviderStatus(): ProviderStatus;
  withProvider(provider: 'groq' | 'gemini'): LLMRouter;
}

interface StreamTextParams {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  system?: string;
  feature: string;
  onFinish?: (result: { text: string }) => Promise<void>;
}

interface GenerateObjectParams<T> {
  schema: z.ZodSchema<T>;
  messages: Message[];
  temperature?: number;
  feature: string;
}

interface ProviderStatus {
  primary: {
    provider: string;
    healthy: boolean;
    rateLimitUsage: { rpm: number; rpd: number };
  };
  fallback?: {
    provider: string;
    healthy: boolean;
  };
  queueDepth: number;
  degradedMode: boolean;
  contentSizeRouting: {
    enabled: boolean;
    thresholdTokens: number;
  };
}
```

### 2. Provider Config

Manages provider-specific configuration and credentials.

**Responsibilities:**
- Load configuration from environment variables
- Validate required settings at startup
- Provide provider-specific API clients
- Store model mappings and feature priorities

**Interface:**

```typescript
interface ProviderCredentials {
  groq: {
    apiKey: string;
    baseURL: string;
  };
  gemini: {
    apiKey: string;
  };
}

interface ProviderModelConfig {
  groq: {
    large: string;
    small: string;
  };
  gemini: {
    default: string;
  };
}

class ProviderConfig {
  static load(): ProviderConfig;
  
  getCredentials(): ProviderCredentials;
  getModelConfig(): ProviderModelConfig;
  getModelForFeature(feature: string): { provider: string; model: string };
  isFeatureEnabled(feature: string, provider: string): boolean;
}
```

### 3. Rate Limit Tracker

Monitors and enforces rate limits for each provider using Redis for distributed tracking.

**Responsibilities:**
- Track requests per minute and per day for each provider
- Enforce rate limits before sending requests
- Provide rate limit status for load balancing decisions
- Reset counters at appropriate intervals
- Predict when limits will be exceeded

**Interface:**

```typescript
interface RateLimitConfig {
  groq: {
    requestsPerMinute: number;
    requestsPerDay: number;
    warningThreshold: number;
    throttleThreshold: number;
  };
  gemini: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

interface RateLimitStatus {
  provider: string;
  rpm: { current: number; limit: number; percentage: number };
  rpd: { current: number; limit: number; percentage: number };
  resetAt: { minute: Date; day: Date };
  shouldThrottle: boolean;
  shouldQueue: boolean;
}

class RateLimitTracker {
  constructor(redis: Redis, config: RateLimitConfig);
  
  async checkLimit(provider: string): Promise<RateLimitStatus>;
  async incrementCount(provider: string): Promise<void>;
  async getStatus(provider: string): Promise<RateLimitStatus>;
  async predictExhaustion(provider: string): Promise<Date | null>;
  async getRollingAverage(provider: string, windowMinutes: number): Promise<number>;
}
```

### 4. Request Queue

Manages pending requests when rate limits are approached, with priority-based processing.

**Responsibilities:**
- Buffer requests when rate limits approach threshold
- Process requests in priority order (FIFO within priority)
- Expire old requests to prevent indefinite waiting
- Provide queue status for user feedback
- Store queue state in Redis for distributed systems

**Interface:**

```typescript
interface QueuedRequest {
  id: string;
  feature: string;
  priority: 'high' | 'medium' | 'low';
  params: StreamTextParams | GenerateObjectParams<any>;
  enqueuedAt: Date;
  expiresAt: Date;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

interface QueueStatus {
  depth: number;
  byPriority: { high: number; medium: number; low: number };
  oldestRequest: Date | null;
  estimatedWaitMs: number;
}

class RequestQueue {
  constructor(redis: Redis, maxSize: number, expirationMs: number);
  
  async enqueue(request: Omit<QueuedRequest, 'id' | 'enqueuedAt' | 'expiresAt'>): Promise<QueuedRequest>;
  async dequeue(): Promise<QueuedRequest | null>;
  async getStatus(): Promise<QueueStatus>;
  async cleanExpired(): Promise<number>;
  async getPosition(requestId: string): Promise<number | null>;
}
```

### 5. Load Balancer

Distributes requests across providers based on current capacity and health status.

**Responsibilities:**
- Select optimal provider for each request
- Consider rate limit usage, health status, and cost
- Implement load balancing algorithms
- Rebalance periodically based on metrics
- Prefer free tier (Groq) when available

**Interface:**

```typescript
interface LoadBalancerConfig {
  preferredProvider: 'groq' | 'gemini';
  rebalanceIntervalMs: number;
  capacityThreshold: number;
  costWeighting: number;
  healthWeighting: number;
}

interface ProviderCapacity {
  provider: string;
  availableRpm: number;
  availableRpd: number;
  healthy: boolean;
  estimatedCost: number;
  score: number;
}

class LoadBalancer {
  constructor(
    rateLimitTracker: RateLimitTracker,
    healthMonitor: HealthMonitor,
    config: LoadBalancerConfig
  );
  
  async selectProvider(feature: string): Promise<string>;
  async getCapacityStatus(): Promise<ProviderCapacity[]>;
  async rebalance(): Promise<void>;
}
```

### 6. Health Monitor

Continuously monitors provider health and performance.

**Responsibilities:**
- Ping providers periodically to check availability
- Measure response latency and success rates
- Mark providers as healthy or unhealthy
- Store health metrics for historical analysis
- Alert when health degrades

**Interface:**

```typescript
interface HealthCheckResult {
  provider: string;
  timestamp: Date;
  available: boolean;
  latencyMs: number;
  error?: string;
}

interface HealthMetrics {
  provider: string;
  successRate: number;
  avgLatencyMs: number;
  lastCheck: Date;
  healthy: boolean;
  consecutiveFailures: number;
}

class HealthMonitor {
  constructor(checkIntervalMs: number, unhealthyThreshold: number);
  
  start(): void;
  stop(): void;
  async getHealth(provider: string): Promise<HealthMetrics>;
  async checkHealth(provider: string): Promise<HealthCheckResult>;
  async getHealthHistory(provider: string, durationMs: number): Promise<HealthCheckResult[]>;
}
```

### 7. Fallback Handler

Manages fallback logic when primary provider fails.

**Responsibilities:**
- Detect failure conditions requiring fallback
- Execute retry with fallback provider
- Log fallback events for monitoring
- Track fallback frequency and patterns
- Respect fallback enable/disable configuration

**Interface:**

```typescript
interface FallbackConfig {
  enabled: boolean;
  maxAttempts: number;
  retryableErrors: string[];
  timeout: number;
}

interface FallbackEvent {
  timestamp: Date;
  feature: string;
  primaryProvider: string;
  fallbackProvider: string;
  reason: string;
  primaryError?: string;
  fallbackSuccess: boolean;
}

class FallbackHandler {
  constructor(config: FallbackConfig);
  
  shouldFallback(error: Error, provider: string): boolean;
  async executeWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    context: { feature: string; primaryProvider: string; fallbackProvider: string }
  ): Promise<T>;
  async getFallbackStats(durationMs: number): Promise<{
    totalFallbacks: number;
    successRate: number;
    byFeature: Record<string, number>;
    byReason: Record<string, number>;
  }>;
}
```

### 8. Cost Tracker

Logs and monitors API usage costs per provider and endpoint.

**Responsibilities:**
- Log every LLM request with token counts
- Calculate estimated costs based on provider pricing
- Aggregate costs by provider, endpoint, and time period
- Expose cost metrics for monitoring
- Alert when costs exceed thresholds

**Interface:**

```typescript
interface CostEntry {
  timestamp: Date;
  provider: string;
  model: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  requestId: string;
}

interface CostSummary {
  provider: string;
  period: { start: Date; end: Date };
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byFeature: Record<string, { requests: number; cost: number }>;
  byModel: Record<string, { requests: number; cost: number }>;
}

class CostTracker {
  constructor(storage: CostStorage);
  
  async logRequest(entry: CostEntry): Promise<void>;
  async getSummary(provider: string, start: Date, end: Date): Promise<CostSummary>;
  async getDailyCost(provider: string, date: Date): Promise<number>;
  async checkThreshold(provider: string, thresholdUSD: number): Promise<boolean>;
}
```

### 9. Throttle Controller

Limits request rate to prevent hitting provider limits.

**Responsibilities:**
- Implement token bucket algorithm for smooth rate limiting
- Enforce maximum requests per minute
- Provide buffer below hard limits
- Coordinate with rate limit tracker
- Allow burst traffic within limits

**Interface:**

```typescript
interface ThrottleConfig {
  provider: string;
  maxRequestsPerMinute: number;
  bufferPercentage: number;
  burstSize: number;
  refillRate: number;
}

class ThrottleController {
  constructor(config: ThrottleConfig);
  
  async tryAcquire(): Promise<boolean>;
  async acquire(timeoutMs: number): Promise<boolean>;
  getStatus(): {
    availableTokens: number;
    maxTokens: number;
    refillRate: number;
    nextRefillAt: Date;
  };
}
```

### 10. Retry Strategy

Implements exponential backoff for handling transient failures.

**Responsibilities:**
- Execute retries with exponential backoff
- Add jitter to prevent thundering herd
- Respect Retry-After headers from providers
- Limit maximum retry attempts
- Skip retries for non-retryable errors

**Interface:**

```typescript
interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
  retryableStatusCodes: number[];
}

class RetryStrategy {
  constructor(config: RetryConfig);
  
  async execute<T>(
    fn: () => Promise<T>,
    context: { feature: string; provider: string }
  ): Promise<T>;
  calculateDelay(attempt: number, retryAfter?: number): number;
  isRetryable(error: Error): boolean;
}
```

### 11. Content Size Detector

Estimates token count from input content to enable intelligent routing based on content size.

**Responsibilities:**
- Estimate token count from messages and content
- Apply heuristic-based token estimation (characters / 4)
- Count tokens from all message components
- Provide routing recommendations based on size thresholds
- Support configurable size thresholds

**Interface:**

```typescript
interface ContentSizeConfig {
  thresholdTokens: number; // Default: 6000
  groqMaxTokens: number; // Default: 8000 (hard limit)
}

interface ContentSizeEstimate {
  estimatedTokens: number;
  recommendedProvider: 'groq' | 'gemini';
  reason: string;
  exceedsGroqLimit: boolean;
}

class ContentSizeDetector {
  constructor(config: ContentSizeConfig);
  
  estimateTokens(messages: Message[], systemPrompt?: string): number;
  getRoutingRecommendation(messages: Message[], systemPrompt?: string): ContentSizeEstimate;
  exceedsProviderLimit(tokenCount: number, provider: 'groq' | 'gemini'): boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```


## Data Models

### Redis Data Structures

The system uses Redis for distributed state management across multiple instances.

**Rate Limit Counters:**

```typescript
// Key: `ratelimit:{provider}:rpm:{minute}`
// Value: number (request count)
// TTL: 60 seconds

// Key: `ratelimit:{provider}:rpd:{day}`
// Value: number (request count)
// TTL: 24 hours

interface RateLimitRedisData {
  rpm: number;
  rpd: number;
  lastReset: {
    minute: string;
    day: string;
  };
}
```

**Request Queue:**

```typescript
// Key: `queue:requests:{priority}`
// Type: Sorted Set (score = enqueuedAt timestamp)
// Members: JSON-serialized QueuedRequest

interface QueueRedisData {
  id: string;
  feature: string;
  priority: 'high' | 'medium' | 'low';
  params: string;
  enqueuedAt: number;
  expiresAt: number;
}
```

**Health Check Results:**

```typescript
// Key: `health:{provider}:checks`
// Type: List (LPUSH new results, LTRIM to keep last 100)
// Members: JSON-serialized HealthCheckResult

interface HealthRedisData {
  timestamp: number;
  available: boolean;
  latencyMs: number;
  error?: string;
}
```

**Provider Status:**

```typescript
// Key: `provider:{provider}:status`
// Type: Hash
// TTL: 5 minutes (refreshed on each update)

interface ProviderStatusRedis {
  healthy: string;
  lastCheck: string;
  consecutiveFailures: string;
  avgLatencyMs: string;
  successRate: string;
}
```

### Database Models (Cost Tracking)

Cost data is stored in a persistent database for historical analysis.

```typescript
// Table: llm_requests
interface LLMRequestRecord {
  id: string;
  timestamp: Date;
  provider: string;
  model: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  fallbackUsed: boolean;
  userId?: string;
}

// Table: cost_summaries (materialized view, updated hourly)
interface CostSummaryRecord {
  id: string;
  provider: string;
  feature: string;
  date: Date;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  successRate: number;
}
```

### Configuration Schema

Environment variables and their validation schema:

```typescript
interface EnvironmentConfig {
  // Provider credentials
  GROQ_API_KEY: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  
  // Provider selection
  PRIMARY_LLM_PROVIDER: 'groq' | 'gemini';
  FALLBACK_LLM_PROVIDER: 'groq' | 'gemini';
  ENABLE_LLM_FALLBACK: 'true' | 'false';
  
  // Model mapping (JSON string)
  LLM_MODEL_MAPPING: string;
  
  // Content size routing
  ENABLE_CONTENT_SIZE_ROUTING: 'true' | 'false';
  CONTENT_SIZE_THRESHOLD_TOKENS: number; // Default: 6000
  
  // Rate limits
  GROQ_RPM_LIMIT: number;
  GROQ_RPD_LIMIT: number;
  
  // Queue configuration
  REQUEST_QUEUE_MAX_SIZE: number;
  REQUEST_QUEUE_EXPIRATION_MS: number;
  
  // Throttle configuration
  THROTTLE_BUFFER_PERCENTAGE: number;
  
  // Health check configuration
  HEALTH_CHECK_INTERVAL_MS: number;
  HEALTH_CHECK_UNHEALTHY_THRESHOLD: number;
  
  // Cost tracking
  COST_ALERT_THRESHOLD_USD: number;
  
  // Redis connection
  REDIS_URL: string;
}

// Default model mapping
const DEFAULT_MODEL_MAPPING = {
  generate: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high', forceProvider: false },
  chat: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high', forceProvider: false },
  flashcards: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'medium', forceProvider: false },
  quiz: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'medium', forceProvider: false },
  mindmap: { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'medium', forceProvider: false },
  rewrite: { provider: 'groq', model: 'llama-3.1-8b-instant', priority: 'low', forceProvider: false },
  'generate-audio-notes': { provider: 'groq', model: 'llama-3.3-70b-versatile', priority: 'high', forceProvider: false },
};
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies and consolidations:

- **Rate limit tracking properties (3.1, 3.2, 3.9)** can be combined into a single property about counter isolation and accuracy
- **Logging properties (4.4, 4.5, 8.1, 12.4, 13.1-13.7, 18.9, 19.7, 21.9)** share common behavior and can be consolidated into comprehensive logging properties
- **Fallback properties (4.1, 4.3, 4.6)** can be unified into a single property about error-triggered fallback
- **Provider routing properties (1.4, 2.3, 12.1, 12.2, 12.6)** can be combined into a property about configuration-driven routing
- **Queue ordering properties (16.2, 17.8, 17.9)** can be unified into a single priority queue property
- **Degraded mode properties (19.2-19.5)** can be combined into a single property about degraded mode behavior
- **Response header properties (20.1, 20.2, 20.3, 20.4, 20.5, 20.8)** can be consolidated into properties about HTTP response correctness
- **Retry properties (21.1, 21.3, 21.4, 21.8, 21.10)** can be unified into comprehensive retry behavior properties

### Property 1: Provider Routing Configuration

*For any* LLM request with a specified feature, the router should route to the provider specified in the model mapping configuration for that feature, unless an endpoint-specific override is configured, in which case the override provider should be used.

**Validates: Requirements 1.4, 2.3, 12.1, 12.2, 12.6**

### Property 2: Rate Limit Counter Isolation

*For any* sequence of requests to different providers, incrementing the rate limit counter for one provider should not affect the counter values for any other provider.

**Validates: Requirements 3.1, 3.2, 3.9**

### Property 3: Groq API Request Formatting

*For any* request routed to Groq Cloud, the request format should conform to Groq's API specification including proper authentication headers, model names, and parameter structure.

**Validates: Requirements 2.4**

### Property 4: Groq Response Parsing

*For any* streaming or structured output response from Groq Cloud, the router should correctly parse the response format and extract the content without data loss.

**Validates: Requirements 2.5, 2.6, 7.3**

### Property 5: Fallback on Retryable Errors

*For any* request where fallback is enabled, when the primary provider returns a 5xx error or rate limit error (429), the router should retry the request with the fallback provider.

**Validates: Requirements 4.1, 4.3**

### Property 6: No Fallback When Disabled

*For any* request where fallback is disabled, when the primary provider fails with any error, the router should return that error to the client without attempting fallback.

**Validates: Requirements 4.6**

### Property 7: Fallback Event Logging

*For any* fallback that occurs, the router should create a log entry containing timestamp, feature name, primary provider, fallback provider, reason for fallback, and whether the fallback succeeded.

**Validates: Requirements 4.4**

### Property 8: Fallback Counter Increment

*For any* fallback that occurs, the fallback counter metric should increment by exactly one.

**Validates: Requirements 4.5**

### Property 9: Structured Output Validation

*For any* structured output request, the router should validate the response against the provided Zod schema before returning it to the caller.

**Validates: Requirements 6.3**

### Property 10: Malformed JSON Handling

*For any* structured output response containing malformed JSON, the router should return a validation error with a descriptive message rather than throwing an unhandled exception.

**Validates: Requirements 6.7**

### Property 11: Streaming Token Delivery

*For any* streaming request, the router should deliver tokens to the client as they arrive from the provider without buffering the entire response.

**Validates: Requirements 7.1**

### Property 12: Request Logging Completeness

*For any* LLM request (successful or failed), the router should create a log entry containing provider, model, feature, token counts, latency, success status, and request ID.

**Validates: Requirements 8.1, 13.1, 13.4, 13.5, 13.6**

### Property 13: Cost Calculation

*For any* LLM request, the cost tracker should calculate an estimated cost based on the provider's pricing model, input tokens, and output tokens.

**Validates: Requirements 8.2**

### Property 14: Cost Aggregation Accuracy

*For any* time period and provider, the sum of individual request costs should equal the aggregated cost for that period and provider.

**Validates: Requirements 8.3, 8.4**

### Property 15: Health Check Latency Measurement

*For any* provider health check, the health monitor should measure and record the response latency in milliseconds.

**Validates: Requirements 9.2**

### Property 16: Success Rate Calculation

*For any* provider over a time window, the success rate should equal the number of successful health checks divided by the total number of health checks in that window.

**Validates: Requirements 9.3**

### Property 17: Queue FIFO with Priority

*For any* sequence of queued requests, when dequeuing, the router should return the oldest request from the highest priority level that has pending requests, ensuring high priority requests are processed before lower priority requests while maintaining FIFO order within each priority level.

**Validates: Requirements 16.2, 17.8**

### Property 18: Starvation Prevention

*For any* sequence of 10 high priority requests processed from the queue, at least 1 low priority request should be processed if low priority requests are available in the queue.

**Validates: Requirements 17.9**

### Property 19: Load Balancer Provider Preference

*For any* request when both Groq Cloud and Gemini API have available capacity (below 80% rate limit) and both are healthy, the load balancer should select Groq Cloud as the provider.

**Validates: Requirements 18.4**

### Property 20: Unhealthy Provider Avoidance

*For any* request when a provider is marked as unhealthy, the load balancer should not select that provider for routing.

**Validates: Requirements 18.5, 18.6**

### Property 21: Load Balancer Decision Logging

*For any* routing decision made by the load balancer, a log entry should be created containing the selected provider, reason for selection, and current capacity metrics for all providers.

**Validates: Requirements 18.9**

### Property 22: Degraded Mode Feature Restrictions

*For any* request while the system is in degraded mode, low priority features (rewrite, batch operations) should be rejected with an appropriate error, and accepted requests should use smaller models, reduced token limits (50% of normal), and non-streaming responses.

**Validates: Requirements 19.2, 19.3, 19.4, 19.5**

### Property 23: Degraded Mode Logging

*For any* transition into or out of degraded mode, a log entry should be created with the timestamp, new mode state, and the rate limit percentages that triggered the transition.

**Validates: Requirements 19.7**

### Property 24: Queued Request Response Format

*For any* request that is queued due to rate limit pressure, the router should return HTTP 202 Accepted with a response body containing the queue position and estimated wait time.

**Validates: Requirements 20.1**

### Property 25: Throttled Request Response Format

*For any* request that is throttled due to rate limiting, the router should return HTTP 429 Too Many Requests with a Retry-After header indicating when to retry.

**Validates: Requirements 20.2, 20.3**

### Property 26: Degraded Mode Response Format

*For any* successful request processed while in degraded mode, the router should return HTTP 206 Partial Content with a response header or body field indicating degraded mode is active.

**Validates: Requirements 20.4**

### Property 27: Rate Limit Headers

*For any* response from the router, rate limit headers should be included showing the remaining capacity (requests remaining) for the current minute and day.

**Validates: Requirements 20.5, 20.8**

### Property 28: Exponential Backoff Retry

*For any* request that fails with a 429 rate limit error, the retry strategy should retry with exponentially increasing delays (doubling each time) up to a maximum delay, with random jitter added to each delay.

**Validates: Requirements 21.1, 21.3, 21.4**

### Property 29: Non-Retryable Error Handling

*For any* request that fails with a 4xx client error (except 429), the retry strategy should not attempt any retries and should immediately return the error to the caller.

**Validates: Requirements 21.8**

### Property 30: Retry-After Header Respect

*For any* request that fails with a response containing a Retry-After header, the retry strategy should wait at least the specified duration before retrying, overriding the calculated exponential backoff delay if the header value is larger.

**Validates: Requirements 21.10**

### Property 31: Retry Attempt Logging

*For any* retry attempt, a log entry should be created containing the attempt number, delay duration, reason for retry, and provider being retried.

**Validates: Requirements 21.9**

### Property 32: Rolling Average Calculation

*For any* provider at any point in time, the rolling average request rate over the last 15 minutes should equal the total number of requests in that window divided by 15.

**Validates: Requirements 22.3**

### Property 33: Log Sanitization

*For any* log entry created by the router, sensitive data including API keys, authentication tokens, and user content should be redacted or excluded from the logged data.

**Validates: Requirements 13.7**

### Property 34: Content-Size-Based Routing

*For any* request where content size routing is enabled and the feature does not force a specific provider, when the estimated token count is less than the configured threshold (default 6000), the router should select Groq Cloud, and when the estimated token count is greater than or equal to the threshold, the router should select Gemini API.

**Validates: Requirements 23.2, 23.3, 23.5**

### Property 35: Groq Context Window Safety

*For any* request where Groq Cloud is selected as the provider, when the estimated token count exceeds 8000 tokens (Groq's context window limit), the router should override the selection and use Gemini API instead to prevent context window errors.

**Validates: Requirements 23.9**

### Property 36: Content Size Routing Logging

*For any* routing decision influenced by content size, the router should create a log entry containing the estimated token count, selected provider, and the reason for selection (content size threshold).

**Validates: Requirements 23.6**


## Error Handling

### Error Categories

The system handles four primary categories of errors:

1. **Configuration Errors**: Missing or invalid environment variables, malformed configuration
2. **Provider Errors**: API failures, rate limits, timeouts from LLM providers
3. **Validation Errors**: Invalid request parameters, schema validation failures
4. **System Errors**: Redis connection failures, database errors, internal bugs

### Error Handling Strategy

**Configuration Errors:**
- Detected at application startup during config validation
- Throw exceptions that prevent server from starting
- Log detailed error messages with missing/invalid configuration keys
- Provide clear remediation steps in error messages

**Provider Errors:**
- Classify errors as retryable (5xx, 429, timeouts) or non-retryable (4xx except 429)
- Apply retry strategy with exponential backoff for retryable errors
- Trigger fallback to secondary provider when configured and appropriate
- Return user-friendly error messages that don't expose internal details
- Log full error details including stack traces for debugging

**Validation Errors:**
- Validate request parameters before sending to providers
- Validate structured output responses against Zod schemas
- Return HTTP 400 Bad Request with specific validation error details
- Retry structured output requests up to 2 times on validation failure
- Log validation failures for monitoring schema compatibility

**System Errors:**
- Implement circuit breakers for Redis and database connections
- Degrade gracefully when Redis is unavailable (disable queuing, use in-memory rate limits)
- Log system errors with full context for debugging
- Return HTTP 503 Service Unavailable for system-level failures
- Alert monitoring systems for critical system errors

### Error Response Format

All error responses follow a consistent format:

```typescript
interface ErrorResponse {
  error: string; // User-friendly error message
  code: string; // Machine-readable error code
  details?: Record<string, any>; // Additional context (dev mode only)
  retryAfter?: number; // Seconds to wait before retry (for 429, 503)
  requestId: string; // For tracing and support
}
```

### Error Codes

```typescript
enum ErrorCode {
  // Configuration errors
  CONFIG_MISSING = 'CONFIG_MISSING',
  CONFIG_INVALID = 'CONFIG_INVALID',
  
  // Provider errors
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMIT = 'PROVIDER_RATE_LIMIT',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  
  // Validation errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
  
  // System errors
  REDIS_UNAVAILABLE = 'REDIS_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  QUEUE_FULL = 'QUEUE_FULL',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

### Graceful Degradation

When critical dependencies fail, the system degrades gracefully:

**Redis Unavailable:**
- Fall back to in-memory rate limit tracking (per-instance, not distributed)
- Disable request queuing
- Continue processing requests with reduced rate limit accuracy
- Log warning about degraded state

**Database Unavailable:**
- Disable cost tracking writes
- Continue processing LLM requests
- Buffer cost data in memory for later persistence
- Log warning about missing cost data

**All Providers Unhealthy:**
- Return HTTP 503 Service Unavailable
- Include estimated time until providers may recover
- Log critical alert for immediate attention

### Timeout Configuration

```typescript
interface TimeoutConfig {
  providerRequest: 30000; // 30 seconds for LLM requests
  healthCheck: 2000; // 2 seconds for health checks
  redisOperation: 1000; // 1 second for Redis operations
  databaseOperation: 5000; // 5 seconds for database operations
  queueWait: 30000; // 30 seconds maximum queue wait time
}
```

## Testing Strategy

### Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs using randomized testing

### Property-Based Testing Configuration

**Framework**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with reference to design document property
- Tag format: `Feature: llm-provider-migration, Property {number}: {property_text}`

**Example Property Test Structure**:

```typescript
import fc from 'fast-check';

describe('Property 2: Rate Limit Counter Isolation', () => {
  it('should maintain separate counters for each provider', async () => {
    // Feature: llm-provider-migration, Property 2: Rate Limit Counter Isolation
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          provider: fc.constantFrom('groq', 'gemini'),
          count: fc.integer({ min: 1, max: 100 })
        })),
        async (requests) => {
          // Test implementation
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Test Coverage

**LLM Router:**
- Provider selection based on configuration
- Fallback triggering on specific error types
- Request parameter transformation
- Response parsing for different formats
- Error handling and propagation

**Rate Limit Tracker:**
- Counter increment and reset logic
- Threshold detection (80%, 90%)
- Redis key expiration
- Distributed counter synchronization

**Request Queue:**
- Enqueue/dequeue operations
- Priority ordering
- Expiration of old requests
- Queue full handling

**Load Balancer:**
- Provider selection algorithm
- Capacity calculation
- Health status consideration
- Cost optimization logic

**Health Monitor:**
- Health check execution
- Latency measurement
- Success rate calculation
- Unhealthy provider detection

**Fallback Handler:**
- Error classification (retryable vs non-retryable)
- Fallback execution flow
- Fallback statistics tracking

**Cost Tracker:**
- Cost calculation per provider
- Token counting
- Aggregation accuracy
- Threshold alerts

**Throttle Controller:**
- Token bucket algorithm
- Burst handling
- Rate limiting enforcement

**Retry Strategy:**
- Exponential backoff calculation
- Jitter addition
- Retry-After header parsing
- Max retry enforcement

### Integration Tests

**Provider Integration:**
- Real API calls to Groq Cloud (test environment)
- Real API calls to Gemini API (test environment)
- Streaming response handling
- Structured output parsing
- Error response handling

**Redis Integration:**
- Rate limit counter operations
- Queue state persistence
- Health check storage
- Distributed locking

**End-to-End Scenarios:**
- Complete request flow from endpoint to provider
- Fallback scenario when primary fails
- Queue activation under load
- Degraded mode activation and recovery
- Cost tracking through full request lifecycle

### Test Data Generators

Property tests require generators for complex data structures:

```typescript
// Generate random LLM requests
const llmRequestArb = fc.record({
  feature: fc.constantFrom('chat', 'generate', 'flashcards', 'quiz', 'mindmap'),
  messages: fc.array(fc.record({
    role: fc.constantFrom('user', 'assistant', 'system'),
    content: fc.string({ minLength: 1, maxLength: 1000 })
  }), { minLength: 1, maxLength: 10 }),
  temperature: fc.option(fc.double({ min: 0, max: 2 })),
  maxTokens: fc.option(fc.integer({ min: 100, max: 4096 }))
});

// Generate random provider responses
const providerResponseArb = fc.oneof(
  fc.record({ success: fc.constant(true), content: fc.string() }),
  fc.record({ success: fc.constant(false), error: fc.string(), statusCode: fc.integer({ min: 400, max: 599 }) })
);

// Generate random rate limit states
const rateLimitStateArb = fc.record({
  provider: fc.constantFrom('groq', 'gemini'),
  rpm: fc.integer({ min: 0, max: 30 }),
  rpd: fc.integer({ min: 0, max: 14400 })
});
```

### Performance Testing

**Load Testing:**
- Simulate concurrent requests to measure throughput
- Test queue behavior under sustained high load
- Verify rate limit enforcement accuracy
- Measure latency overhead of router layer

**Stress Testing:**
- Push system beyond rate limits to test degradation
- Verify graceful handling of provider failures
- Test recovery after Redis/database outages
- Measure memory usage under queue buildup

**Benchmarking:**
- Measure router overhead vs direct API calls
- Compare latency across different providers
- Benchmark rate limit check performance
- Profile hot paths for optimization opportunities

### Monitoring and Observability

**Metrics to Track:**
- Request count per provider, feature, and status
- Rate limit usage percentage (rpm, rpd)
- Queue depth and wait times
- Fallback frequency and success rate
- Provider health status and latency
- Cost per provider and feature
- Error rates by type and provider

**Alerting Thresholds:**
- Rate limit usage > 90%
- Queue depth > 50 requests
- Provider unhealthy for > 5 minutes
- Fallback rate > 10% of requests
- Daily cost > configured threshold
- Error rate > 5% of requests

**Logging Strategy:**
- Structured JSON logs for machine parsing
- Request ID tracing through entire flow
- Sensitive data sanitization
- Log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
- Separate log streams for audit, performance, and errors

