# Implementation Plan: LLM Provider Migration

## Overview

This plan implements a migration from Google Gemini API to a hybrid LLM architecture using Groq Cloud's free tier (14,400 req/day, 30 req/min) as the primary provider with intelligent fallback to Gemini. The implementation includes comprehensive rate limiting, request queuing, load balancing, and monitoring capabilities.

The migration follows an incremental approach with per-endpoint rollout capability and comprehensive testing at each stage.

## Tasks

- [ ] 1. Set up core infrastructure and configuration
  - [x] 1.1 Install dependencies and configure environment
    - Install `@ai-sdk/groq` package for Groq Cloud integration
    - Install `ioredis` for Redis client (rate limiting and queue state)
    - Install `fast-check` for property-based testing
    - Add environment variables to `.env`: `GROQ_API_KEY`, `PRIMARY_LLM_PROVIDER`, `FALLBACK_LLM_PROVIDER`, `ENABLE_LLM_FALLBACK`, `LLM_MODEL_MAPPING`, `REDIS_URL`
    - _Requirements: 2.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [x] 1.2 Create provider configuration module
    - Create `src/lib/llm/config.ts` with `ProviderConfig` class
    - Implement environment variable loading and validation
    - Define default model mappings for all 7 endpoints (generate, chat, flashcards, quiz, mindmap, rewrite, generate-audio-notes)
    - Implement configuration error handling with descriptive messages
    - _Requirements: 1.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 10.7_
  
  - [x] 1.3 Write unit tests for provider configuration
    - Test environment variable validation
    - Test default model mapping
    - Test configuration error handling
    - _Requirements: 15.1_

- [ ] 2. Implement Redis-backed rate limit tracking
  - [x] 2.1 Create rate limit tracker module
    - Create `src/lib/llm/rateLimitTracker.ts` with `RateLimitTracker` class
    - Implement Redis counter increment for RPM and RPD
    - Implement counter reset logic (60s for RPM, 24h for RPD)
    - Implement threshold detection (80%, 90%)
    - Implement `checkLimit()`, `incrementCount()`, `getStatus()` methods
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 3.9_
  
  - [x] 2.2 Write property test for rate limit counter isolation
    - **Property 2: Rate Limit Counter Isolation**
    - **Validates: Requirements 3.1, 3.2, 3.9**
    - Test that incrementing one provider's counter doesn't affect other providers
  
  - [x] 2.3 Write unit tests for rate limit tracker
    - Test counter increment and reset
    - Test threshold detection
    - Test Redis key expiration
    - _Requirements: 15.3_

- [ ] 3. Implement request queue with priority support
  - [x] 3.1 Create request queue module
    - Create `src/lib/llm/requestQueue.ts` with `RequestQueue` class
    - Implement Redis-backed FIFO queue with three priority levels (high, medium, low)
    - Implement `enqueue()`, `dequeue()`, `getStatus()`, `cleanExpired()` methods
    - Implement 30-second expiration for queued requests
    - Implement maximum queue size of 100 requests
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.8, 16.9_
  
  - [x] 3.2 Write property test for queue FIFO with priority
    - **Property 17: Queue FIFO with Priority**
    - **Validates: Requirements 16.2, 17.8**
    - Test that high priority requests are processed before lower priority while maintaining FIFO within each level
  
  - [x] 3.3 Write property test for starvation prevention
    - **Property 18: Starvation Prevention**
    - **Validates: Requirements 17.9**
    - Test that at least 1 low priority request is processed for every 10 high priority requests
  
  - [x] 3.4 Write unit tests for request queue
    - Test enqueue/dequeue operations
    - Test priority ordering
    - Test expiration handling
    - Test queue full scenario
    - _Requirements: 15.3_

- [ ] 4. Implement throttle controller
  - [x] 4.1 Create throttle controller module
    - Create `src/lib/llm/throttleController.ts` with `ThrottleController` class
    - Implement token bucket algorithm for smooth rate limiting
    - Set Groq Cloud limit to 25 RPM (buffer below 30 RPM hard limit)
    - Implement `tryAcquire()`, `acquire()`, `getStatus()` methods
    - _Requirements: 16.5, 16.6_
  
  - [x] 4.2 Write unit tests for throttle controller
    - Test token bucket algorithm
    - Test burst handling
    - Test rate limiting enforcement

- [ ] 5. Implement health monitoring
  - [x] 5.1 Create health monitor module
    - Create `src/lib/llm/healthMonitor.ts` with `HealthMonitor` class
    - Implement periodic health checks (every 5 minutes) for both providers
    - Implement latency measurement and success rate tracking
    - Implement unhealthy provider detection (3 consecutive failures)
    - Store health check results in Redis
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [x] 5.2 Write property test for success rate calculation
    - **Property 16: Success Rate Calculation**
    - **Validates: Requirements 9.3**
    - Test that success rate equals successful checks divided by total checks
  
  - [x] 5.3 Write unit tests for health monitor
    - Test health check execution
    - Test latency measurement
    - Test unhealthy detection
    - _Requirements: 15.6_

- [ ] 6. Implement load balancer
  - [x] 6.1 Create load balancer module
    - Create `src/lib/llm/loadBalancer.ts` with `LoadBalancer` class
    - Implement provider selection algorithm considering rate limits, health, and cost
    - Prefer Groq Cloud when both providers have capacity below 80%
    - Route to Gemini when Groq exceeds 80% rate limit
    - Avoid unhealthy providers
    - Implement periodic rebalancing (every 10 seconds)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_
  
  - [x] 6.2 Write property test for provider preference
    - **Property 19: Load Balancer Provider Preference**
    - **Validates: Requirements 18.4**
    - Test that Groq is selected when both providers have capacity below 80%
  
  - [x] 6.3 Write property test for unhealthy provider avoidance
    - **Property 20: Unhealthy Provider Avoidance**
    - **Validates: Requirements 18.5, 18.6**
    - Test that unhealthy providers are never selected
  
  - [x] 6.4 Write unit tests for load balancer
    - Test provider selection logic
    - Test capacity calculation
    - Test health consideration
    - _Requirements: 15.4_

- [x] 7. Checkpoint - Verify infrastructure components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement retry strategy with exponential backoff
  - [x] 8.1 Create retry strategy module
    - Create `src/lib/llm/retryStrategy.ts` with `RetryStrategy` class
    - Implement exponential backoff (1s initial, doubling, max 32s)
    - Add random jitter (0-500ms) to prevent thundering herd
    - Implement max 3 retries for 429 errors, 2 retries for 5xx errors
    - Skip retries for 4xx errors except 429
    - Respect Retry-After headers from providers
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.10_
  
  - [x] 8.2 Write property test for exponential backoff
    - **Property 28: Exponential Backoff Retry**
    - **Validates: Requirements 21.1, 21.3, 21.4**
    - Test that delays double with each retry and include jitter
  
  - [x] 8.3 Write property test for non-retryable errors
    - **Property 29: Non-Retryable Error Handling**
    - **Validates: Requirements 21.8**
    - Test that 4xx errors (except 429) are not retried
  
  - [x] 8.4 Write property test for Retry-After header respect
    - **Property 30: Retry-After Header Respect**
    - **Validates: Requirements 21.10**
    - Test that Retry-After header overrides calculated delay when larger
  
  - [x] 8.5 Write unit tests for retry strategy
    - Test exponential backoff calculation
    - Test jitter addition
    - Test max retry enforcement
    - _Requirements: 15.9_

- [ ] 9. Implement fallback handler
  - [x] 9.1 Create fallback handler module
    - Create `src/lib/llm/fallbackHandler.ts` with `FallbackHandler` class
    - Implement error classification (retryable: 5xx, 429, timeout)
    - Implement `executeWithFallback()` method
    - Log all fallback events with timestamp, reason, providers
    - Increment fallback counter metric
    - Support enable/disable configuration
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [x] 9.2 Write property test for fallback on retryable errors
    - **Property 5: Fallback on Retryable Errors**
    - **Validates: Requirements 4.1, 4.3**
    - Test that 5xx and 429 errors trigger fallback when enabled
  
  - [x] 9.3 Write property test for no fallback when disabled
    - **Property 6: No Fallback When Disabled**
    - **Validates: Requirements 4.6**
    - Test that errors are returned without fallback when disabled
  
  - [x] 9.4 Write unit tests for fallback handler
    - Test error classification
    - Test fallback execution
    - Test fallback statistics
    - _Requirements: 15.2_

- [ ] 10. Implement cost tracking
  - [x] 10.1 Create cost tracker module
    - Create `src/lib/llm/costTracker.ts` with `CostTracker` class
    - Implement request logging with provider, model, tokens, timestamp
    - Implement cost calculation based on provider pricing
    - Implement daily and per-endpoint cost aggregation
    - Store cost data in database (create `llm_requests` table)
    - Implement threshold alerts
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  
  - [x] 10.2 Write property test for cost aggregation accuracy
    - **Property 14: Cost Aggregation Accuracy**
    - **Validates: Requirements 8.3, 8.4**
    - Test that sum of individual costs equals aggregated cost
  
  - [x] 10.3 Write unit tests for cost tracker
    - Test cost calculation
    - Test aggregation
    - Test threshold alerts

- [x] 11. Implement core LLM router
  - [x] 11.1 Create LLM router module
    - Create `src/lib/llm/router.ts` with `LLMRouter` class
    - Implement `streamText()` method with provider routing
    - Implement `generateObject()` method with provider routing
    - Integrate rate limit tracker, queue, throttle, load balancer, health monitor
    - Implement request logging with request ID for tracing
    - Implement timeout handling (30s default)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 13.1, 13.6, 14.3, 14.4_
  
  - [x] 11.2 Implement Groq Cloud integration in router
    - Format requests according to Groq API specification
    - Handle Groq streaming responses (SSE format)
    - Handle Groq structured output responses (JSON mode)
    - Map Llama 3.3 70B for complex tasks (generate, chat, mindmap)
    - Map Llama 3.1 8B for lightweight tasks (flashcards, quiz, rewrite)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 11.3 Implement provider fallback in router
    - Integrate fallback handler
    - Execute fallback on primary provider failure
    - Log fallback events
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 11.4 Implement structured output validation
    - Validate responses against Zod schemas
    - Retry up to 2 times on validation failure
    - Handle malformed JSON gracefully
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [x] 11.5 Write property test for provider routing configuration
    - **Property 1: Provider Routing Configuration**
    - **Validates: Requirements 1.4, 2.3, 12.1, 12.2, 12.6**
    - Test that requests route to configured provider per feature
  
  - [x] 11.6 Write property test for Groq request formatting
    - **Property 3: Groq API Request Formatting**
    - **Validates: Requirements 2.4**
    - Test that Groq requests conform to API specification
  
  - [x] 11.7 Write property test for Groq response parsing
    - **Property 4: Groq Response Parsing**
    - **Validates: Requirements 2.5, 2.6, 7.3**
    - Test that Groq responses are parsed correctly without data loss
  
  - [x] 11.8 Write property test for structured output validation
    - **Property 9: Structured Output Validation**
    - **Validates: Requirements 6.3**
    - Test that responses are validated against Zod schemas
  
  - [x] 11.9 Write property test for malformed JSON handling
    - **Property 10: Malformed JSON Handling**
    - **Validates: Requirements 6.7**
    - Test that malformed JSON returns validation error, not exception
  
  - [x] 11.10 Write property test for streaming token delivery
    - **Property 11: Streaming Token Delivery**
    - **Validates: Requirements 7.1**
    - Test that tokens are delivered as they arrive without buffering
  
  - [x] 11.11 Write property test for request logging completeness
    - **Property 12: Request Logging Completeness**
    - **Validates: Requirements 8.1, 13.1, 13.4, 13.5, 13.6**
    - Test that all requests create log entries with required fields
  
  - [x] 11.12 Write unit tests for LLM router
    - Test provider selection
    - Test streaming support
    - Test structured output
    - Test error handling
    - _Requirements: 15.1, 15.2, 15.6, 15.7_

- [x] 12. Checkpoint - Verify core router functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement degraded mode handling
  - [x] 13.1 Add degraded mode logic to router
    - Detect degraded mode when both providers exceed 90% rate limit
    - Disable low priority features (rewrite, batch operations)
    - Switch to smaller models (Llama 3.1 8B instead of 3.3 70B)
    - Reduce token limits by 50%
    - Disable streaming, return complete responses only
    - Exit degraded mode when usage drops below 70%
    - Log mode transitions
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8_
  
  - [x] 13.2 Write property test for degraded mode restrictions
    - **Property 22: Degraded Mode Feature Restrictions**
    - **Validates: Requirements 19.2, 19.3, 19.4, 19.5**
    - Test that degraded mode applies all restrictions correctly
  
  - [x] 13.3 Write unit tests for degraded mode
    - Test mode activation
    - Test feature restrictions
    - Test mode exit

- [x] 14. Implement user-facing rate limit feedback
  - [x] 14.1 Add rate limit response headers and status codes
    - Return HTTP 202 with queue position when request is queued
    - Return HTTP 429 with Retry-After header when throttled
    - Return HTTP 206 with degradation notice in degraded mode
    - Include rate limit headers showing remaining capacity
    - Include user-friendly error messages
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8_
  
  - [x] 14.2 Write property test for queued request response format
    - **Property 24: Queued Request Response Format**
    - **Validates: Requirements 20.1**
    - Test that queued requests return HTTP 202 with queue position
  
  - [x] 14.3 Write property test for throttled request response format
    - **Property 25: Throttled Request Response Format**
    - **Validates: Requirements 20.2, 20.3**
    - Test that throttled requests return HTTP 429 with Retry-After
  
  - [x] 14.4 Write property test for degraded mode response format
    - **Property 26: Degraded Mode Response Format**
    - **Validates: Requirements 20.4**
    - Test that degraded mode returns HTTP 206 with notice
  
  - [x] 14.5 Write property test for rate limit headers
    - **Property 27: Rate Limit Headers**
    - **Validates: Requirements 20.5, 20.8**
    - Test that all responses include rate limit headers

- [x] 15. Implement rate limit prediction
  - [x] 15.1 Add prediction logic to rate limit tracker
    - Implement `predictExhaustion()` method based on current trends
    - Implement `getRollingAverage()` for 15-minute window
    - Trigger proactive throttling when predicted to exceed daily limit
    - Send alerts when usage exceeds 50% by noon UTC
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7_
  
  - [x] 15.2 Write property test for rolling average calculation
    - **Property 32: Rolling Average Calculation**
    - **Validates: Requirements 22.3**
    - Test that rolling average equals total requests divided by window size
  
  - [x] 15.3 Write unit tests for prediction logic
    - Test exhaustion prediction
    - Test rolling average
    - Test proactive throttling

- [x] 16. Implement monitoring and observability
  - [x] 16.1 Create monitoring endpoint
    - Create `/api/llm/status` endpoint exposing provider health, rate limits, queue depth
    - Create `/api/llm/metrics` endpoint exposing cost data and performance metrics
    - Implement structured JSON logging for all LLM operations
    - Add request ID tracing through entire flow
    - Sanitize sensitive data (API keys, user content) from logs
    - _Requirements: 9.6, 9.7, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_
  
  - [x] 16.2 Write property test for log sanitization
    - **Property 33: Log Sanitization**
    - **Validates: Requirements 13.7**
    - Test that API keys and sensitive data are redacted from logs
  
  - [x] 16.3 Write unit tests for monitoring endpoints
    - Test status endpoint
    - Test metrics endpoint
    - Test log sanitization

- [x] 17. Checkpoint - Verify monitoring and advanced features
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17.5 Implement content-size-based routing
  - [x] 17.5.1 Create content size detector module
    - Create `src/lib/llm/contentSizeDetector.ts` with `ContentSizeDetector` class
    - Implement token estimation using character count / 4 heuristic
    - Implement `estimateTokens()` method that counts all message content
    - Implement `getRoutingRecommendation()` method that returns provider based on threshold
    - Implement `exceedsProviderLimit()` method to check against Groq's 8K limit
    - Support configurable threshold via environment variable
    - _Requirements: 23.1, 23.4, 23.7, 23.8, 23.9_
  
  - [x] 17.5.2 Integrate content size routing into LLM router
    - Add content size detection to router's provider selection logic
    - Route to Groq when content < 6K tokens (configurable)
    - Route to Gemini when content >= 6K tokens
    - Override to Gemini when content > 8K tokens (Groq limit)
    - Respect forceProvider flag in model mapping to bypass content routing
    - Log routing decisions with estimated token count
    - _Requirements: 23.2, 23.3, 23.5, 23.6, 23.9_
  
  - [x] 17.5.3 Add content size routing configuration
    - Add `ENABLE_CONTENT_SIZE_ROUTING` environment variable
    - Add `CONTENT_SIZE_THRESHOLD_TOKENS` environment variable (default: 6000)
    - Update Provider_Config to load content size routing settings
    - Add `forceProvider` flag to model mapping configuration
    - _Requirements: 23.5, 23.8_
  
  - [x] 17.5.4 Write property test for content-size routing
    - **Property 34: Content-Size-Based Routing**
    - **Validates: Requirements 23.2, 23.3, 23.5**
    - Test that requests below threshold route to Groq, above threshold route to Gemini
  
  - [x] 17.5.5 Write property test for Groq context window safety
    - **Property 35: Groq Context Window Safety**
    - **Validates: Requirements 23.9**
    - Test that requests exceeding 8K tokens never route to Groq
  
  - [x] 17.5.6 Write property test for content size routing logging
    - **Property 36: Content Size Routing Logging**
    - **Validates: Requirements 23.6**
    - Test that routing decisions include estimated token count in logs
  
  - [x] 17.5.7 Write unit tests for content size detector
    - Test token estimation accuracy
    - Test routing recommendations
    - Test provider limit checking
    - Test threshold configuration
    - _Requirements: 23.1, 23.4, 23.7_
  
  - [x] 17.5.8 Update monitoring endpoint to expose content size metrics
    - Add content size routing statistics to `/api/llm/status` endpoint
    - Include average content size per feature
    - Include routing decision breakdown (Groq vs Gemini by content size)
    - _Requirements: 23.10_

- [x] 18. Migrate /api/chat endpoint
  - [x] 18.1 Update chat endpoint to use LLM router
    - Replace `google('gemini-2.5-flash')` with `llmRouter.streamText()`
    - Set feature name to 'chat' and priority to 'high'
    - Preserve existing streaming behavior and onFinish callback
    - Preserve existing error handling
    - Add per-endpoint provider override support via environment variable
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.1, 11.2, 11.3, 11.4, 12.1, 12.4, 17.1_
  
  - [x] 18.2 Write integration test for chat endpoint
    - Test streaming response
    - Test message history
    - Test error handling
    - _Requirements: 15.4, 15.7_

- [x] 19. Migrate /api/generate endpoint
  - [x] 19.1 Update generate endpoint to use LLM router
    - Replace `google('gemini-2.5-flash')` with `llmRouter.streamText()`
    - Set feature name to 'generate' and priority to 'high'
    - Preserve existing streaming behavior
    - Preserve existing error handling and duplicate detection
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.1, 11.2, 11.3, 11.4, 12.1, 12.4, 17.2_
  
  - [x] 19.2 Write integration test for generate endpoint
    - Test note generation
    - Test YouTube transcript processing
    - Test audio transcription
    - _Requirements: 15.4, 15.7_

- [x] 20. Migrate /api/flashcards endpoint
  - [x] 20.1 Update flashcards endpoint to use LLM router
    - Replace `google('gemini-2.5-flash')` with `llmRouter.generateObject()`
    - Set feature name to 'flashcards' and priority to 'medium'
    - Preserve existing Zod schema validation
    - Preserve existing error handling
    - _Requirements: 1.2, 6.1, 6.2, 6.3, 6.6, 11.4, 12.1, 12.4, 17.3_
  
  - [x] 20.2 Write integration test for flashcards endpoint
    - Test structured output generation
    - Test schema validation
    - Test error handling
    - _Requirements: 15.4, 15.5, 15.6_

- [x] 21. Migrate /api/quiz endpoint
  - [x] 21.1 Update quiz endpoint to use LLM router
    - Replace `google('gemini-2.5-flash')` with `llmRouter.generateObject()`
    - Set feature name to 'quiz' and priority to 'medium'
    - Preserve existing Zod schema validation
    - Preserve existing error handling
    - _Requirements: 1.2, 6.1, 6.2, 6.3, 6.6, 11.4, 12.1, 12.4, 17.4_
  
  - [x] 21.2 Write integration test for quiz endpoint
    - Test structured output generation
    - Test schema validation
    - _Requirements: 15.4, 15.5, 15.6_

- [ ] 22. Migrate /api/mindmap endpoint
  - [x] 22.1 Update mindmap endpoint to use LLM router
    - Replace `google('gemini-2.5-flash')` with `llmRouter.generateObject()`
    - Set feature name to 'mindmap' and priority to 'medium'
    - Preserve existing Zod schema validation
    - Preserve existing error handling
    - _Requirements: 1.2, 6.1, 6.2, 6.3, 6.6, 11.4, 12.1, 12.4, 17.5_
  
  - [x] 22.2 Write integration test for mindmap endpoint
    - Test structured output generation
    - Test schema validation
    - _Requirements: 15.4, 15.5, 15.6_

- [x] 23. Migrate /api/rewrite endpoint
  - [x] 23.1 Update rewrite endpoint to use LLM router
    - Replace `google('gemini-2.5-flash')` with `llmRouter.streamText()`
    - Set feature name to 'rewrite' and priority to 'low'
    - Preserve existing streaming behavior
    - Preserve existing error handling
    - _Requirements: 1.1, 1.3, 11.1, 11.2, 11.3, 12.1, 12.4, 17.6_
  
  - [x] 23.2 Write integration test for rewrite endpoint
    - Test streaming response
    - Test error handling
    - _Requirements: 15.4, 15.7_

- [x] 24. Migrate /api/generate-audio-notes endpoint
  - [x] 24.1 Update generate-audio-notes endpoint to use LLM router
    - Replace `google('gemini-2.5-flash')` with `llmRouter.streamText()`
    - Set feature name to 'generate-audio-notes' and priority to 'high'
    - Preserve existing streaming behavior
    - Preserve existing error handling
    - _Requirements: 1.1, 1.3, 11.1, 11.2, 11.3, 12.1, 12.4, 17.7_
  
  - [x] 24.2 Write integration test for generate-audio-notes endpoint
    - Test streaming response
    - Test error handling
    - _Requirements: 15.4, 15.7_

- [x] 25. Checkpoint - Verify all endpoint migrations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 26. Add database migration for cost tracking
  - [x] 26.1 Create Prisma migration for llm_requests table
    - Add `llm_requests` table with fields: id, timestamp, provider, model, feature, inputTokens, outputTokens, estimatedCost, latencyMs, success, errorCode, fallbackUsed, userId
    - Add indexes on timestamp, provider, feature for efficient querying
    - _Requirements: 8.1, 8.6_
  
  - [x] 26.2 Create Prisma migration for cost_summaries view
    - Add `cost_summaries` table for materialized view
    - Add fields: id, provider, feature, date, totalRequests, totalTokens, totalCost, avgLatencyMs, successRate
    - _Requirements: 8.3, 8.4_

- [x] 27. Implement graceful degradation for Redis failures
  - [x] 27.1 Add fallback logic for Redis unavailability
    - Implement in-memory rate limit tracking when Redis is unavailable
    - Disable request queuing when Redis is unavailable
    - Log warnings about degraded state
    - Continue processing requests with reduced accuracy
    - _Requirements: 14.5_
  
  - [x] 27.2 Write unit tests for Redis failure handling
    - Test in-memory fallback
    - Test queue disable
    - Test continued operation

- [x] 28. Add rollback mechanism
  - [x] 28.1 Implement global rollback configuration
    - Add `LLM_MIGRATION_ENABLED` environment variable
    - When false, bypass router and use Gemini directly
    - Add per-endpoint rollback via `LLM_ENDPOINT_OVERRIDES` JSON config
    - Log rollback events
    - _Requirements: 12.1, 12.3, 12.6, 12.7_
  
  - [x] 28.2 Write unit tests for rollback mechanism
    - Test global rollback
    - Test per-endpoint rollback
    - Test rollback logging

- [x] 29. Final integration testing and validation
  - [x] 29.1 Run end-to-end integration tests
    - Test complete request flow from endpoint to provider
    - Test fallback scenario when primary fails
    - Test queue activation under load
    - Test degraded mode activation and recovery
    - Test cost tracking through full lifecycle
    - _Requirements: 15.4, 15.5_
  
  - [x] 29.2 Run performance benchmarks
    - Measure router overhead vs direct API calls
    - Compare latency across providers
    - Benchmark rate limit check performance
    - Verify first token latency under 500ms for Groq
    - _Requirements: 14.1, 14.2, 14.4_
  
  - [x] 29.3 Run load and stress tests
    - Simulate concurrent requests
    - Test queue behavior under sustained load
    - Verify rate limit enforcement accuracy
    - Test recovery after failures
    - _Requirements: 14.5_

- [x] 30. Documentation and deployment preparation
  - [x] 30.1 Create deployment documentation
    - Document environment variable configuration
    - Document Redis setup requirements
    - Document monitoring endpoint usage
    - Document rollback procedures
    - Document cost tracking queries
  
  - [x] 30.2 Create operational runbook
    - Document common issues and resolutions
    - Document alert thresholds and responses
    - Document scaling considerations
    - Document provider quota management

- [x] 31. Final checkpoint - Production readiness
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The migration is designed for incremental rollout with per-endpoint control
- Redis is required for distributed rate limiting and queue state
- All endpoints preserve existing behavior while adding new capabilities
- Rollback mechanism allows reverting to Gemini if issues occur
