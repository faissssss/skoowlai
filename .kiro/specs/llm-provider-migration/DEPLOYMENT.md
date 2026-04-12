# LLM Provider Migration - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the LLM Provider Migration system to production. The system uses Groq Cloud as the primary LLM provider with intelligent fallback to Google Gemini API, featuring rate limiting, request queuing, load balancing, and comprehensive monitoring.

## Prerequisites

Before deploying, ensure you have:

- Node.js 18+ installed
- Redis instance (for distributed rate limiting and queue state)
- PostgreSQL database (for cost tracking)
- Groq API key (free tier: 14,400 req/day, 30 req/min)
- Google Gemini API key (for fallback)
- Access to deployment environment (Vercel, AWS, etc.)

## Environment Variables Configuration

### Required Variables

```bash
# Provider API Keys
GROQ_API_KEY=gsk_your_groq_api_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here

# Provider Selection
PRIMARY_LLM_PROVIDER=groq
FALLBACK_LLM_PROVIDER=gemini
ENABLE_LLM_FALLBACK=true

# Redis Connection
REDIS_URL=redis://your-redis-host:6379

# Database Connection (for cost tracking)
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Optional Configuration Variables

```bash
# Model Mapping (JSON string)
# Default: Uses Llama 3.3 70B for complex tasks, Llama 3.1 8B for lightweight tasks
LLM_MODEL_MAPPING='{"generate":{"provider":"groq","model":"llama-3.3-70b-versatile","priority":"high","forceProvider":false},"chat":{"provider":"groq","model":"llama-3.3-70b-versatile","priority":"high","forceProvider":false},"flashcards":{"provider":"groq","model":"llama-3.1-8b-instant","priority":"medium","forceProvider":false},"quiz":{"provider":"groq","model":"llama-3.1-8b-instant","priority":"medium","forceProvider":false},"mindmap":{"provider":"groq","model":"llama-3.3-70b-versatile","priority":"medium","forceProvider":false},"rewrite":{"provider":"groq","model":"llama-3.1-8b-instant","priority":"low","forceProvider":false},"generate-audio-notes":{"provider":"groq","model":"llama-3.3-70b-versatile","priority":"high","forceProvider":false}}'

# Content Size Routing
ENABLE_CONTENT_SIZE_ROUTING=true
CONTENT_SIZE_THRESHOLD_TOKENS=6000

# Rate Limits (Groq Cloud free tier defaults)
GROQ_RPM_LIMIT=30
GROQ_RPD_LIMIT=14400

# Request Queue Configuration
REQUEST_QUEUE_MAX_SIZE=100
REQUEST_QUEUE_EXPIRATION_MS=30000

# Throttle Configuration (buffer below hard limits)
THROTTLE_BUFFER_PERCENTAGE=15

# Health Check Configuration
HEALTH_CHECK_INTERVAL_MS=300000
HEALTH_CHECK_UNHEALTHY_THRESHOLD=3

# Cost Tracking
COST_ALERT_THRESHOLD_USD=10.00

# Migration Control (for rollback)
LLM_MIGRATION_ENABLED=true
```

### Environment-Specific Configuration

**Development:**
```bash
NODE_ENV=development
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://localhost:5432/dev_db
ENABLE_LLM_FALLBACK=true
```

**Staging:**
```bash
NODE_ENV=staging
REDIS_URL=redis://staging-redis:6379
DATABASE_URL=postgresql://staging-db:5432/staging_db
ENABLE_LLM_FALLBACK=true
COST_ALERT_THRESHOLD_USD=5.00
```

**Production:**
```bash
NODE_ENV=production
REDIS_URL=redis://prod-redis:6379
DATABASE_URL=postgresql://prod-db:5432/prod_db
ENABLE_LLM_FALLBACK=true
COST_ALERT_THRESHOLD_USD=50.00
```

## Redis Setup Requirements

### Redis Configuration

The system requires Redis for:
- Distributed rate limit tracking across multiple instances
- Request queue state management
- Provider health check results storage
- Temporary caching of provider status

**Minimum Redis Version:** 6.0+

**Required Redis Features:**
- String operations (for counters)
- Sorted sets (for priority queue)
- Hash operations (for provider status)
- Key expiration (TTL)
- Atomic operations (INCR, ZADD)

### Redis Deployment Options

**Option 1: Managed Redis (Recommended for Production)**

- **Vercel KV** (Redis-compatible, serverless)
  ```bash
  # Automatically configured via Vercel dashboard
  KV_REST_API_URL=https://your-kv-instance.vercel.com
  KV_REST_API_TOKEN=your_token_here
  ```

- **AWS ElastiCache**
  ```bash
  REDIS_URL=redis://your-cluster.cache.amazonaws.com:6379
  ```

- **Redis Cloud**
  ```bash
  REDIS_URL=redis://default:password@redis-12345.cloud.redislabs.com:12345
  ```

**Option 2: Self-Hosted Redis**

```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf

# Key settings:
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Start Redis
sudo systemctl start redis
sudo systemctl enable redis

# Test connection
redis-cli ping
```

### Redis Memory Estimation

Estimated memory usage per instance:
- Rate limit counters: ~1 KB per provider
- Request queue: ~10 KB per 100 queued requests
- Health check history: ~5 KB per provider
- Provider status: ~2 KB per provider

**Total estimated memory:** 50-100 MB for typical workload

### Redis Connection Pooling

The system uses `ioredis` with connection pooling:

```typescript
// Automatic configuration in src/lib/llm/redis.ts
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});
```

## Database Migration

### Running Prisma Migrations

The system requires a database migration to add cost tracking tables.

**Step 1: Review the migration**
```bash
# View pending migrations
npx prisma migrate status
```

**Step 2: Apply the migration**
```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

**Step 3: Verify tables**
```bash
# Check that tables exist
npx prisma db pull
```

### Database Schema

The migration creates two tables:

**llm_requests** (main cost tracking table):
```sql
CREATE TABLE llm_requests (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  feature TEXT NOT NULL,
  inputTokens INTEGER NOT NULL,
  outputTokens INTEGER NOT NULL,
  estimatedCost DECIMAL(10, 6) NOT NULL,
  latencyMs INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  errorCode TEXT,
  fallbackUsed BOOLEAN NOT NULL,
  userId TEXT
);

CREATE INDEX idx_llm_requests_timestamp ON llm_requests(timestamp);
CREATE INDEX idx_llm_requests_provider ON llm_requests(provider);
CREATE INDEX idx_llm_requests_feature ON llm_requests(feature);
```

**cost_summaries** (aggregated cost data):
```sql
CREATE TABLE cost_summaries (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  feature TEXT NOT NULL,
  date DATE NOT NULL,
  totalRequests INTEGER NOT NULL,
  totalTokens INTEGER NOT NULL,
  totalCost DECIMAL(10, 2) NOT NULL,
  avgLatencyMs INTEGER NOT NULL,
  successRate DECIMAL(5, 2) NOT NULL
);

CREATE UNIQUE INDEX idx_cost_summaries_unique ON cost_summaries(provider, feature, date);
```

## Deployment Steps

### Step 1: Pre-Deployment Validation

```bash
# Validate configuration
npm run validate-llm-config

# Run all tests
npm test

# Run integration tests
npm run test:integration

# Check for TypeScript errors
npm run type-check
```

### Step 2: Deploy to Staging

```bash
# Set staging environment variables
export NODE_ENV=staging
export REDIS_URL=redis://staging-redis:6379
# ... other staging variables

# Build the application
npm run build

# Run database migrations
npx prisma migrate deploy

# Deploy to staging environment
# (Vercel example)
vercel --env staging

# Verify deployment
curl https://staging.yourdomain.com/api/llm/status
```

### Step 3: Smoke Testing

```bash
# Test monitoring endpoints
curl https://staging.yourdomain.com/api/llm/status
curl https://staging.yourdomain.com/api/llm/metrics

# Test a simple LLM request
curl -X POST https://staging.yourdomain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# Check logs for errors
# (Vercel example)
vercel logs staging.yourdomain.com
```

### Step 4: Gradual Rollout (Recommended)

Use feature flags to enable the migration incrementally:

```bash
# Enable for one endpoint first
LLM_MODEL_MAPPING='{"chat":{"provider":"groq","model":"llama-3.3-70b-versatile","priority":"high"}}'

# Monitor for 24 hours, then enable more endpoints
LLM_MODEL_MAPPING='{"chat":{"provider":"groq",...},"generate":{"provider":"groq",...}}'

# Continue until all endpoints are migrated
```

### Step 5: Deploy to Production

```bash
# Set production environment variables
export NODE_ENV=production
export REDIS_URL=redis://prod-redis:6379
# ... other production variables

# Build the application
npm run build

# Run database migrations
npx prisma migrate deploy

# Deploy to production
vercel --prod

# Verify deployment
curl https://yourdomain.com/api/llm/status
```

### Step 6: Post-Deployment Verification

```bash
# Check system status
curl https://yourdomain.com/api/llm/status | jq

# Expected response:
# {
#   "primary": {
#     "provider": "groq",
#     "healthy": true,
#     "rateLimitUsage": { "rpm": 5, "rpd": 120 }
#   },
#   "fallback": {
#     "provider": "gemini",
#     "healthy": true
#   },
#   "queueDepth": 0,
#   "degradedMode": false
# }

# Monitor metrics
curl https://yourdomain.com/api/llm/metrics | jq

# Check logs for errors
# Look for: fallback events, rate limit warnings, errors
```

## Monitoring Endpoint Usage

### Status Endpoint

**GET /api/llm/status**

Returns current system status including provider health, rate limits, and queue depth.

```bash
curl https://yourdomain.com/api/llm/status
```

Response:
```json
{
  "primary": {
    "provider": "groq",
    "healthy": true,
    "rateLimitUsage": {
      "rpm": 12,
      "rpd": 3456
    }
  },
  "fallback": {
    "provider": "gemini",
    "healthy": true
  },
  "queueDepth": 0,
  "degradedMode": false,
  "contentSizeRouting": {
    "enabled": true,
    "thresholdTokens": 6000
  }
}
```

### Metrics Endpoint

**GET /api/llm/metrics**

Returns detailed metrics including cost data and performance statistics.

```bash
curl https://yourdomain.com/api/llm/metrics
```

Response:
```json
{
  "costs": {
    "groq": {
      "today": 0.00,
      "thisMonth": 0.00,
      "byFeature": {
        "chat": { "requests": 1234, "cost": 0.00 },
        "generate": { "requests": 567, "cost": 0.00 }
      }
    },
    "gemini": {
      "today": 2.45,
      "thisMonth": 45.67,
      "byFeature": {
        "chat": { "requests": 89, "cost": 1.23 }
      }
    }
  },
  "performance": {
    "groq": {
      "avgLatencyMs": 234,
      "successRate": 99.8
    },
    "gemini": {
      "avgLatencyMs": 456,
      "successRate": 99.9
    }
  },
  "fallbacks": {
    "total": 12,
    "successRate": 100,
    "byReason": {
      "rate_limit": 8,
      "timeout": 3,
      "server_error": 1
    }
  }
}
```

### Health Check Endpoint

**GET /api/health/billing**

Existing health check endpoint that now includes LLM provider status.

```bash
curl https://yourdomain.com/api/health/billing
```

## Rollback Procedures

### Emergency Rollback (Immediate)

If critical issues occur, immediately disable the migration:

```bash
# Set environment variable
LLM_MIGRATION_ENABLED=false

# Redeploy
vercel --prod

# Or use Vercel dashboard to update environment variable and redeploy
```

This bypasses the LLM router entirely and reverts to direct Gemini API calls.

### Partial Rollback (Per-Endpoint)

Roll back specific endpoints while keeping others on Groq:

```bash
# Rollback chat endpoint only
LLM_MODEL_MAPPING='{"chat":{"provider":"gemini","model":"gemini-2.5-flash","priority":"high","forceProvider":true},"generate":{"provider":"groq","model":"llama-3.3-70b-versatile","priority":"high"},...}'

# Redeploy
vercel --prod
```

### Gradual Rollback

If issues are not critical, roll back gradually:

1. **Monitor metrics** to identify problematic endpoints
2. **Roll back one endpoint** at a time
3. **Wait 1 hour** between rollbacks to verify stability
4. **Document issues** for investigation

### Rollback Verification

After rollback, verify system is working:

```bash
# Check status
curl https://yourdomain.com/api/llm/status

# Verify provider is Gemini
# Expected: "provider": "gemini"

# Test endpoints
curl -X POST https://yourdomain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Test"}]}'

# Check error rates in logs
```

## Cost Tracking Queries

### Daily Cost by Provider

```sql
SELECT 
  provider,
  DATE(timestamp) as date,
  COUNT(*) as total_requests,
  SUM(inputTokens + outputTokens) as total_tokens,
  SUM(estimatedCost) as total_cost
FROM llm_requests
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY provider, DATE(timestamp)
ORDER BY date DESC, provider;
```

### Cost by Feature

```sql
SELECT 
  feature,
  provider,
  COUNT(*) as requests,
  SUM(estimatedCost) as cost,
  AVG(latencyMs) as avg_latency_ms,
  SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as success_rate
FROM llm_requests
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY feature, provider
ORDER BY cost DESC;
```

### Fallback Analysis

```sql
SELECT 
  feature,
  COUNT(*) as total_fallbacks,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_fallbacks,
  AVG(latencyMs) as avg_latency_ms
FROM llm_requests
WHERE fallbackUsed = true
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY feature
ORDER BY total_fallbacks DESC;
```

### Cost Trend Analysis

```sql
SELECT 
  DATE(timestamp) as date,
  provider,
  SUM(estimatedCost) as daily_cost,
  COUNT(*) as requests,
  SUM(estimatedCost) / COUNT(*) as cost_per_request
FROM llm_requests
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp), provider
ORDER BY date DESC;
```

### High-Cost Requests

```sql
SELECT 
  id,
  timestamp,
  feature,
  provider,
  model,
  inputTokens,
  outputTokens,
  estimatedCost,
  latencyMs
FROM llm_requests
WHERE estimatedCost > 0.10
  AND timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY estimatedCost DESC
LIMIT 20;
```

### Provider Performance Comparison

```sql
SELECT 
  provider,
  COUNT(*) as total_requests,
  AVG(latencyMs) as avg_latency_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latencyMs) as p50_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latencyMs) as p95_latency_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latencyMs) as p99_latency_ms,
  SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as success_rate
FROM llm_requests
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY provider;
```

## Troubleshooting

### Issue: High Rate Limit Usage

**Symptoms:** Rate limit usage consistently above 80%

**Solution:**
1. Check `/api/llm/status` for current usage
2. Enable content-size routing to shift large requests to Gemini
3. Increase `THROTTLE_BUFFER_PERCENTAGE` to be more conservative
4. Consider upgrading to Groq paid tier

### Issue: Redis Connection Failures

**Symptoms:** Errors mentioning Redis, degraded mode active

**Solution:**
1. Check Redis connectivity: `redis-cli -u $REDIS_URL ping`
2. Verify Redis credentials in environment variables
3. System will degrade gracefully with in-memory rate limiting
4. Fix Redis connection and restart application

### Issue: High Fallback Rate

**Symptoms:** Many requests falling back to Gemini

**Solution:**
1. Check `/api/llm/metrics` for fallback reasons
2. If rate limits: Reduce traffic or upgrade Groq tier
3. If timeouts: Check Groq service status
4. If errors: Review logs for specific error messages

### Issue: Cost Exceeding Budget

**Symptoms:** Cost alert triggered, high Gemini usage

**Solution:**
1. Query cost by feature to identify expensive endpoints
2. Verify content-size routing is enabled
3. Check if fallback is triggering too frequently
4. Consider adjusting `CONTENT_SIZE_THRESHOLD_TOKENS` lower

## Security Considerations

### API Key Management

- Store API keys in environment variables, never in code
- Use secret management services (AWS Secrets Manager, Vercel Environment Variables)
- Rotate API keys regularly (quarterly recommended)
- Monitor for unauthorized API key usage

### Log Sanitization

The system automatically sanitizes logs to remove:
- API keys and authentication tokens
- User content (PII)
- Internal system details

Verify sanitization is working:
```bash
# Check logs for sensitive data
grep -i "api_key\|token\|password" logs/*.log
# Should return no results
```

### Network Security

- Use TLS/SSL for all Redis connections
- Restrict Redis access to application servers only
- Use VPC/private networks for database connections
- Enable Redis authentication (requirepass)

## Performance Optimization

### Redis Optimization

```bash
# Monitor Redis performance
redis-cli --latency
redis-cli --stat

# Check memory usage
redis-cli INFO memory

# Optimize if needed
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_llm_requests_timestamp_provider 
ON llm_requests(timestamp, provider);

CREATE INDEX CONCURRENTLY idx_llm_requests_feature_timestamp 
ON llm_requests(feature, timestamp);

-- Analyze query performance
EXPLAIN ANALYZE 
SELECT * FROM llm_requests 
WHERE timestamp >= NOW() - INTERVAL '24 hours';
```

### Application Optimization

- Enable connection pooling for Redis and database
- Use caching for provider configuration
- Monitor memory usage and optimize if needed
- Profile hot paths with performance monitoring tools

## Maintenance

### Regular Tasks

**Daily:**
- Check `/api/llm/status` for system health
- Review error logs for anomalies
- Monitor cost metrics

**Weekly:**
- Review fallback statistics
- Analyze cost trends
- Check rate limit usage patterns
- Review performance metrics

**Monthly:**
- Rotate API keys
- Review and optimize cost allocation
- Update documentation
- Review and update alert thresholds

### Backup and Recovery

**Redis Backup:**
```bash
# Enable Redis persistence
redis-cli CONFIG SET save "900 1 300 10 60 10000"

# Manual backup
redis-cli BGSAVE

# Restore from backup
cp /var/lib/redis/dump.rdb /var/lib/redis/dump.rdb.backup
redis-cli SHUTDOWN
cp /var/lib/redis/dump.rdb.backup /var/lib/redis/dump.rdb
redis-server
```

**Database Backup:**
```bash
# Backup cost tracking data
pg_dump -t llm_requests -t cost_summaries $DATABASE_URL > llm_backup.sql

# Restore
psql $DATABASE_URL < llm_backup.sql
```

## Support and Resources

### Documentation
- Requirements: `.kiro/specs/llm-provider-migration/requirements.md`
- Design: `.kiro/specs/llm-provider-migration/design.md`
- Tasks: `.kiro/specs/llm-provider-migration/tasks.md`
- Operations: `.kiro/specs/llm-provider-migration/OPERATIONS.md`

### External Resources
- Groq Cloud Documentation: https://console.groq.com/docs
- Google Gemini API: https://ai.google.dev/docs
- Redis Documentation: https://redis.io/docs
- Vercel Deployment: https://vercel.com/docs

### Monitoring Dashboards
- System Status: `https://yourdomain.com/api/llm/status`
- Metrics: `https://yourdomain.com/api/llm/metrics`
- Health Check: `https://yourdomain.com/api/health/billing`
