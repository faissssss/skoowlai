# Requirements Document: LLM Provider Migration

## Introduction

This document specifies the requirements for migrating the application's LLM infrastructure from Google Gemini API to a more cost-effective solution utilizing Groq Cloud's free tier with high rate limits. The migration aims to reduce operational costs while maintaining or improving service quality for the current low-user-volume phase.

The application currently uses:
- **Gemini 2.5 Flash** for 7 endpoints: note generation, chat, flashcards, quiz, mindmap, rewrite, and audio note generation
- **Groq Whisper** for 2 endpoints: voice transcription and audio file transcription

The proposed architecture will leverage Groq Cloud's free tier (14,400 requests/day, 30 requests/minute for Llama models) as the primary provider, with optional fallback to Gemini for specific use cases.

## Glossary

- **LLM_Router**: The abstraction layer that routes requests to appropriate LLM providers
- **Primary_Provider**: The default LLM provider used for requests (Groq Cloud)
- **Fallback_Provider**: The secondary LLM provider used when Primary_Provider fails or is unavailable (Gemini API)
- **Provider_Config**: Configuration object containing API keys, model names, and provider-specific settings
- **Rate_Limit_Tracker**: Component that monitors and enforces rate limits for each provider
- **Model_Mapping**: Configuration that maps application features to specific LLM models
- **Provider_Health_Check**: Mechanism to verify provider availability and response quality
- **Cost_Tracker**: Component that logs and monitors API usage costs per provider
- **Groq_Cloud**: Free LLM provider with high rate limits (14,400 req/day, 30 req/min)
- **Gemini_API**: Google's LLM service (current provider)
- **Streaming_Response**: Real-time token-by-token response delivery for chat and generation endpoints
- **Structured_Output**: JSON schema-validated responses for flashcards, quiz, and mindmap endpoints
- **Request_Queue**: FIFO queue that holds pending LLM requests when rate limits are approached
- **Request_Priority**: Classification of requests by importance (interactive, batch, background)
- **Load_Balancer**: Component that distributes requests across multiple providers based on current capacity
- **Throttle_Controller**: Component that limits request rate to prevent hitting provider limits
- **Retry_Strategy**: Exponential backoff mechanism for handling transient failures
- **Content_Size_Detector**: Component that estimates token count from input content to enable intelligent routing based on content size

## Requirements

### Requirement 1: LLM Provider Abstraction Layer

**User Story:** As a developer, I want a unified interface for LLM providers, so that I can switch between providers without changing endpoint code.

#### Acceptance Criteria

1. THE LLM_Router SHALL provide a unified interface for text generation requests
2. THE LLM_Router SHALL provide a unified interface for structured output generation requests
3. THE LLM_Router SHALL provide a unified interface for streaming text generation requests
4. WHEN an endpoint requests text generation, THE LLM_Router SHALL route the request to the configured Primary_Provider
5. THE LLM_Router SHALL accept Provider_Config containing API keys, model names, and provider-specific parameters
6. THE LLM_Router SHALL support both Groq_Cloud and Gemini_API as valid providers
7. THE Model_Mapping SHALL define which LLM model to use for each application feature

### Requirement 2: Groq Cloud Integration

**User Story:** As a system administrator, I want to integrate Groq Cloud as the primary LLM provider, so that I can reduce API costs while maintaining service quality.

#### Acceptance Criteria

1. THE LLM_Router SHALL support Groq Cloud's Llama 3.3 70B model for text generation
2. THE LLM_Router SHALL support Groq Cloud's Llama 3.1 8B model for lightweight tasks
3. WHEN Groq_Cloud is configured as Primary_Provider, THE LLM_Router SHALL use Groq API endpoints
4. THE LLM_Router SHALL format requests according to Groq Cloud's API specification
5. THE LLM_Router SHALL handle Groq Cloud's response format for streaming requests
6. THE LLM_Router SHALL handle Groq Cloud's response format for structured output requests
7. THE Provider_Config SHALL store the Groq API key securely in environment variables

### Requirement 3: Rate Limit Management

**User Story:** As a system administrator, I want to track and enforce rate limits, so that I stay within provider quotas and avoid service disruptions.

#### Acceptance Criteria

1. THE Rate_Limit_Tracker SHALL monitor requests per minute for Groq_Cloud
2. THE Rate_Limit_Tracker SHALL monitor requests per day for Groq_Cloud
3. WHEN Groq_Cloud rate limit approaches 80 percent, THE Rate_Limit_Tracker SHALL activate request queuing
4. WHEN Groq_Cloud rate limit approaches 90 percent, THE Rate_Limit_Tracker SHALL log a warning
5. WHEN Groq_Cloud rate limit is exceeded, THE LLM_Router SHALL return an error response with retry-after information
6. THE Rate_Limit_Tracker SHALL reset minute counters every 60 seconds
7. THE Rate_Limit_Tracker SHALL reset daily counters at midnight UTC
8. THE Rate_Limit_Tracker SHALL store rate limit state in Redis for distributed tracking
9. THE Rate_Limit_Tracker SHALL track rate limit usage separately for Groq_Cloud and Gemini_API

### Requirement 4: Provider Fallback Strategy

**User Story:** As a user, I want the system to remain available even when the primary provider fails, so that I can continue using the application without interruption.

#### Acceptance Criteria

1. WHERE fallback is enabled, WHEN Primary_Provider returns a 5xx error, THE LLM_Router SHALL retry the request with Fallback_Provider
2. WHERE fallback is enabled, WHEN Primary_Provider times out after 30 seconds, THE LLM_Router SHALL retry the request with Fallback_Provider
3. WHERE fallback is enabled, WHEN Primary_Provider returns a rate limit error, THE LLM_Router SHALL retry the request with Fallback_Provider
4. THE LLM_Router SHALL log all fallback events with timestamp, reason, and provider details
5. THE LLM_Router SHALL increment a fallback counter metric for monitoring
6. WHERE fallback is disabled, WHEN Primary_Provider fails, THE LLM_Router SHALL return the error to the client
7. THE Provider_Config SHALL allow enabling or disabling fallback per endpoint

### Requirement 5: Model Selection Strategy

**User Story:** As a developer, I want to map application features to appropriate models, so that I can optimize for cost and performance based on task complexity.

#### Acceptance Criteria

1. THE Model_Mapping SHALL assign Llama 3.3 70B to note generation endpoints
2. THE Model_Mapping SHALL assign Llama 3.3 70B to chat endpoints
3. THE Model_Mapping SHALL assign Llama 3.1 8B to flashcard generation endpoints
4. THE Model_Mapping SHALL assign Llama 3.1 8B to quiz generation endpoints
5. THE Model_Mapping SHALL assign Llama 3.3 70B to mindmap generation endpoints
6. THE Model_Mapping SHALL assign Llama 3.1 8B to rewrite endpoints
7. THE Model_Mapping SHALL be configurable via environment variables or configuration file

### Requirement 6: Structured Output Compatibility

**User Story:** As a developer, I want structured outputs to work with Groq models, so that flashcards, quizzes, and mindmaps generate correctly.

#### Acceptance Criteria

1. WHEN using Groq_Cloud for structured output, THE LLM_Router SHALL use JSON mode with schema validation
2. WHEN Groq_Cloud does not support native structured output, THE LLM_Router SHALL parse JSON from text responses
3. THE LLM_Router SHALL validate structured output against Zod schemas before returning
4. IF structured output validation fails, THEN THE LLM_Router SHALL retry the request up to 2 times
5. IF structured output validation fails after retries, THEN THE LLM_Router SHALL return a validation error
6. THE LLM_Router SHALL preserve existing Zod schemas for flashcards, quizzes, and mindmaps
7. THE LLM_Router SHALL handle malformed JSON responses gracefully with error messages

### Requirement 7: Streaming Response Support

**User Story:** As a user, I want real-time responses for chat and note generation, so that I can see progress and receive faster perceived performance.

#### Acceptance Criteria

1. WHEN an endpoint uses streaming, THE LLM_Router SHALL stream tokens from Groq_Cloud in real-time
2. THE LLM_Router SHALL maintain streaming compatibility with Vercel AI SDK's streamText function
3. THE LLM_Router SHALL handle Groq Cloud's Server-Sent Events (SSE) format
4. WHEN streaming fails mid-response, THE LLM_Router SHALL log the error and close the stream gracefully
5. THE LLM_Router SHALL preserve existing streaming behavior for chat and generate endpoints
6. THE LLM_Router SHALL support streaming for both Groq_Cloud and Gemini_API
7. THE LLM_Router SHALL include proper error boundaries for streaming failures

### Requirement 8: Cost Tracking and Monitoring

**User Story:** As a system administrator, I want to track API usage and costs, so that I can monitor spending and optimize provider selection.

#### Acceptance Criteria

1. THE Cost_Tracker SHALL log every LLM request with provider, model, token count, and timestamp
2. THE Cost_Tracker SHALL calculate estimated cost per request based on provider pricing
3. THE Cost_Tracker SHALL aggregate daily costs per provider
4. THE Cost_Tracker SHALL aggregate daily costs per endpoint
5. THE Cost_Tracker SHALL expose cost metrics via a monitoring dashboard or API endpoint
6. THE Cost_Tracker SHALL log cost data to a persistent storage system
7. WHEN daily costs exceed a configured threshold, THE Cost_Tracker SHALL send an alert notification

### Requirement 9: Provider Health Monitoring

**User Story:** As a system administrator, I want to monitor provider health and performance, so that I can detect issues proactively and make informed decisions.

#### Acceptance Criteria

1. THE Provider_Health_Check SHALL ping each provider's API every 5 minutes
2. THE Provider_Health_Check SHALL measure response latency for each provider
3. THE Provider_Health_Check SHALL track success rate percentage for each provider
4. WHEN a provider's success rate drops below 95 percent over 15 minutes, THE Provider_Health_Check SHALL log a warning
5. WHEN a provider is unreachable for 3 consecutive health checks, THE Provider_Health_Check SHALL mark it as unhealthy
6. THE Provider_Health_Check SHALL expose health status via a monitoring endpoint
7. THE Provider_Health_Check SHALL store health metrics in a time-series database for historical analysis

### Requirement 10: Configuration Management

**User Story:** As a developer, I want to configure provider settings via environment variables, so that I can deploy different configurations across environments without code changes.

#### Acceptance Criteria

1. THE Provider_Config SHALL read the primary provider name from environment variable PRIMARY_LLM_PROVIDER
2. THE Provider_Config SHALL read the fallback provider name from environment variable FALLBACK_LLM_PROVIDER
3. THE Provider_Config SHALL read Groq API key from environment variable GROQ_API_KEY
4. THE Provider_Config SHALL read Gemini API key from environment variable GOOGLE_GENERATIVE_AI_API_KEY
5. THE Provider_Config SHALL read fallback enable flag from environment variable ENABLE_LLM_FALLBACK
6. THE Provider_Config SHALL read model mappings from environment variable LLM_MODEL_MAPPING
7. WHEN a required environment variable is missing, THE Provider_Config SHALL throw a configuration error at startup

### Requirement 11: Backward Compatibility

**User Story:** As a developer, I want existing endpoints to work without modification, so that I can migrate providers without breaking changes.

#### Acceptance Criteria

1. THE LLM_Router SHALL maintain the same function signatures as existing Vercel AI SDK calls
2. THE LLM_Router SHALL support the same parameters as google() function from @ai-sdk/google
3. THE LLM_Router SHALL return responses in the same format as existing implementations
4. WHEN migrating an endpoint, THE LLM_Router SHALL require only changing the model provider import
5. THE LLM_Router SHALL preserve existing error handling behavior
6. THE LLM_Router SHALL preserve existing temperature and token limit parameters
7. THE LLM_Router SHALL work with existing Zod schemas without modification

### Requirement 12: Migration Safety

**User Story:** As a developer, I want to migrate endpoints incrementally, so that I can validate each migration and rollback if issues occur.

#### Acceptance Criteria

1. THE LLM_Router SHALL support per-endpoint provider override via configuration
2. WHERE endpoint override is set, THE LLM_Router SHALL use the specified provider instead of Primary_Provider
3. THE LLM_Router SHALL allow running Groq_Cloud and Gemini_API simultaneously for different endpoints
4. THE LLM_Router SHALL log which provider is used for each request
5. THE LLM_Router SHALL support feature flags for enabling Groq_Cloud per endpoint
6. WHEN a feature flag is disabled, THE LLM_Router SHALL use Gemini_API as before
7. THE LLM_Router SHALL provide a rollback mechanism to revert to Gemini_API globally

### Requirement 13: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error logging, so that I can debug issues and understand provider behavior.

#### Acceptance Criteria

1. WHEN an LLM request fails, THE LLM_Router SHALL log the error with provider, model, and error details
2. WHEN a fallback occurs, THE LLM_Router SHALL log the original error and fallback provider used
3. WHEN rate limits are hit, THE LLM_Router SHALL log the rate limit details and reset time
4. THE LLM_Router SHALL log request duration for performance monitoring
5. THE LLM_Router SHALL log token counts for cost tracking
6. THE LLM_Router SHALL include request IDs in all logs for tracing
7. THE LLM_Router SHALL sanitize sensitive data from logs including API keys and user content

### Requirement 14: Performance Requirements

**User Story:** As a user, I want fast response times, so that the application feels responsive and efficient.

#### Acceptance Criteria

1. WHEN using Groq_Cloud, THE LLM_Router SHALL complete streaming requests with first token latency under 500 milliseconds
2. WHEN using Groq_Cloud, THE LLM_Router SHALL complete structured output requests within 10 seconds for simple schemas
3. THE LLM_Router SHALL timeout requests after 30 seconds to prevent hanging
4. THE LLM_Router SHALL add less than 50 milliseconds of overhead compared to direct API calls
5. THE Rate_Limit_Tracker SHALL check rate limits in under 10 milliseconds
6. THE Provider_Health_Check SHALL complete health checks within 2 seconds
7. THE LLM_Router SHALL cache provider configurations to avoid repeated environment variable reads

### Requirement 15: Testing and Validation

**User Story:** As a developer, I want comprehensive tests for the LLM router, so that I can ensure reliability and catch regressions.

#### Acceptance Criteria

1. THE LLM_Router SHALL have unit tests for provider selection logic
2. THE LLM_Router SHALL have unit tests for fallback behavior
3. THE LLM_Router SHALL have unit tests for rate limit tracking
4. THE LLM_Router SHALL have integration tests with Groq_Cloud API
5. THE LLM_Router SHALL have integration tests with Gemini_API
6. THE LLM_Router SHALL have tests for structured output parsing and validation
7. THE LLM_Router SHALL have tests for streaming response handling

### Requirement 16: Request Queuing and Throttling

**User Story:** As a system administrator, I want requests to be queued when approaching rate limits, so that the system handles traffic spikes gracefully without rejecting requests.

#### Acceptance Criteria

1. WHEN rate limit usage exceeds 80 percent, THE Request_Queue SHALL buffer incoming requests
2. THE Request_Queue SHALL process queued requests in FIFO order when capacity becomes available
3. THE Request_Queue SHALL have a maximum size of 100 pending requests
4. WHEN Request_Queue is full, THE LLM_Router SHALL return a 503 Service Unavailable error with retry-after header
5. THE Throttle_Controller SHALL limit request rate to 25 requests per minute for Groq_Cloud to maintain buffer
6. THE Throttle_Controller SHALL use token bucket algorithm for smooth rate limiting
7. WHEN a request is queued, THE LLM_Router SHALL return queue position and estimated wait time to the client
8. THE Request_Queue SHALL automatically expire requests older than 30 seconds
9. THE Request_Queue SHALL store queue state in Redis for distributed systems

### Requirement 17: Request Prioritization

**User Story:** As a user, I want interactive features to remain responsive during high load, so that my experience is not degraded by background operations.

#### Acceptance Criteria

1. THE LLM_Router SHALL classify chat requests as high priority
2. THE LLM_Router SHALL classify note generation requests as high priority
3. THE LLM_Router SHALL classify flashcard generation requests as medium priority
4. THE LLM_Router SHALL classify quiz generation requests as medium priority
5. THE LLM_Router SHALL classify mindmap generation requests as medium priority
6. THE LLM_Router SHALL classify rewrite requests as low priority
7. THE LLM_Router SHALL classify batch operations as low priority
8. WHEN Request_Queue is active, THE LLM_Router SHALL process high priority requests before medium and low priority requests
9. THE LLM_Router SHALL prevent starvation by processing at least 1 low priority request for every 10 high priority requests
10. THE Request_Priority SHALL be configurable via environment variable or request header

### Requirement 18: Intelligent Load Balancing

**User Story:** As a system administrator, I want requests distributed across providers based on current capacity, so that I maximize free tier usage while maintaining performance.

#### Acceptance Criteria

1. THE Load_Balancer SHALL track current rate limit usage for both Groq_Cloud and Gemini_API
2. WHEN Groq_Cloud rate limit exceeds 80 percent, THE Load_Balancer SHALL route new requests to Gemini_API
3. WHEN both providers exceed 80 percent rate limit, THE Load_Balancer SHALL activate request queuing
4. THE Load_Balancer SHALL prefer Groq_Cloud for requests when both providers have available capacity
5. THE Load_Balancer SHALL consider provider health status when making routing decisions
6. WHEN a provider is marked unhealthy, THE Load_Balancer SHALL route all requests to healthy providers
7. THE Load_Balancer SHALL distribute load to minimize total cost across providers
8. THE Load_Balancer SHALL rebalance every 10 seconds based on current usage metrics
9. THE Load_Balancer SHALL log all routing decisions with provider, reason, and current capacity

### Requirement 19: Graceful Degradation

**User Story:** As a user, I want the system to continue functioning with reduced features when rate limits are hit, so that I can still accomplish critical tasks.

#### Acceptance Criteria

1. WHEN both providers exceed 90 percent rate limit, THE LLM_Router SHALL enable degraded mode
2. WHILE in degraded mode, THE LLM_Router SHALL disable low priority features including rewrite and batch operations
3. WHILE in degraded mode, THE LLM_Router SHALL reduce response quality by using smaller models
4. WHILE in degraded mode, THE LLM_Router SHALL reduce token limits by 50 percent for all requests
5. WHILE in degraded mode, THE LLM_Router SHALL disable streaming and return complete responses only
6. WHEN rate limit usage drops below 70 percent, THE LLM_Router SHALL exit degraded mode
7. THE LLM_Router SHALL log degraded mode activation and deactivation events
8. THE LLM_Router SHALL notify monitoring systems when entering degraded mode

### Requirement 20: User-Facing Rate Limit Feedback

**User Story:** As a user, I want clear feedback when rate limits affect my request, so that I understand what is happening and when to retry.

#### Acceptance Criteria

1. WHEN a request is queued, THE LLM_Router SHALL return HTTP 202 Accepted with queue position in response body
2. WHEN a request is throttled, THE LLM_Router SHALL return HTTP 429 Too Many Requests with Retry-After header
3. WHEN rate limits are hit, THE LLM_Router SHALL include estimated wait time in error response
4. WHEN system is in degraded mode, THE LLM_Router SHALL return HTTP 206 Partial Content with degradation notice
5. THE LLM_Router SHALL include rate limit headers in all responses showing remaining capacity
6. THE LLM_Router SHALL provide user-friendly error messages explaining rate limit situations
7. WHEN a request fails due to rate limits, THE LLM_Router SHALL suggest alternative actions to the user
8. THE LLM_Router SHALL include current system load percentage in response headers for monitoring

### Requirement 21: Smart Retry Mechanisms

**User Story:** As a developer, I want automatic retry logic with exponential backoff, so that transient failures are handled gracefully without manual intervention.

#### Acceptance Criteria

1. WHEN a request fails with 429 rate limit error, THE Retry_Strategy SHALL retry with exponential backoff
2. THE Retry_Strategy SHALL use initial backoff delay of 1 second
3. THE Retry_Strategy SHALL double backoff delay for each retry up to maximum of 32 seconds
4. THE Retry_Strategy SHALL add random jitter between 0 and 500 milliseconds to prevent thundering herd
5. THE Retry_Strategy SHALL attempt maximum of 3 retries before returning error to client
6. WHEN a request fails with 5xx server error, THE Retry_Strategy SHALL retry up to 2 times with 2 second delay
7. WHEN a request times out, THE Retry_Strategy SHALL retry once with increased timeout of 45 seconds
8. THE Retry_Strategy SHALL not retry 4xx client errors except for 429 rate limit errors
9. THE Retry_Strategy SHALL log all retry attempts with attempt number, delay, and reason
10. THE Retry_Strategy SHALL respect Retry-After header from provider responses when present

### Requirement 22: Rate Limit Prediction and Prevention

**User Story:** As a system administrator, I want proactive rate limit management, so that the system prevents hitting limits rather than reacting to them.

#### Acceptance Criteria

1. THE Rate_Limit_Tracker SHALL predict when daily rate limit will be exceeded based on current usage trends
2. WHEN predicted to exceed daily limit, THE Throttle_Controller SHALL reduce request rate proactively
3. THE Rate_Limit_Tracker SHALL calculate rolling average request rate over last 15 minutes
4. WHEN rolling average exceeds sustainable rate, THE Throttle_Controller SHALL activate throttling
5. THE Rate_Limit_Tracker SHALL forecast remaining capacity for next hour based on historical patterns
6. WHEN forecast shows capacity shortage, THE Load_Balancer SHALL shift traffic to alternative provider
7. THE Rate_Limit_Tracker SHALL send alerts when daily usage exceeds 50 percent by noon UTC
8. THE Rate_Limit_Tracker SHALL provide capacity planning metrics via monitoring dashboard

### Requirement 23: Intelligent Content-Size-Based Routing

**User Story:** As a system administrator, I want requests routed based on content size, so that small requests use cost-effective Groq while large requests use Gemini's large context windows.

#### Acceptance Criteria

1. THE Content_Size_Detector SHALL estimate token count from input messages and content
2. WHEN estimated token count is less than 6000 tokens, THE LLM_Router SHALL prefer Groq_Cloud as the provider
3. WHEN estimated token count is greater than or equal to 6000 tokens, THE LLM_Router SHALL prefer Gemini_API as the provider
4. THE Content_Size_Detector SHALL use character count divided by 4 as token estimation heuristic
5. WHERE a feature is configured to always use Gemini_API, THE LLM_Router SHALL bypass content size routing
6. THE LLM_Router SHALL log routing decisions with estimated token count and selected provider
7. THE Content_Size_Detector SHALL count tokens from all messages including system prompts and user content
8. THE Provider_Config SHALL allow configuring the content size threshold via environment variable CONTENT_SIZE_THRESHOLD_TOKENS
9. WHEN Groq_Cloud is selected but content exceeds 8000 tokens, THE LLM_Router SHALL override to Gemini_API to prevent context window errors
10. THE LLM_Router SHALL expose content size routing metrics via monitoring endpoint
