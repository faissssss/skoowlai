# LLM Provider Migration - Operational Runbook

## Overview

This runbook provides operational procedures for managing the LLM Provider Migration system in production. It covers common issues, alert responses, scaling considerations, and provider quota management.

## Table of Contents

1. [Common Issues and Resolutions](#common-issues-and-resolutions)
2. [Alert Thresholds and Responses](#alert-thresholds-and-responses)
3. [Scaling Considerations](#scaling-considerations)
4. [Provider Quota Management](#provider-quota-management)
5. [Incident Response Procedures](#incident-response-procedures)
6. [Performance Tuning](#performance-tuning)

---

## Common Issues and Resolutions

### Issue 1: Rate Limit Exceeded

**Symptoms:**
- HTTP 429 responses to clients
- Rate limit usage at 100% in `/api/llm/status`
- Logs showing "Rate limit exceeded" errors
- Requests being queued or rejected

**Root Causes:**
- Traffic spike exceeding Groq's 30 req/min or 14,400 req/day limits
- Insufficient throttling buffer
- Content-size routing disabled, sending large requests to Groq

**Diagnosis:**
```bash
# Check current rate limit status
curl https://yourdomain.com/api/llm/status | jq '.primary.rateLimitUsage'

# Check recent request volume
psql $DATABASE_URL -c "
  SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    COUNT(*) as requests,
    provider
  FROM llm_requests
  WHERE timestamp >= NOW() - INTERVAL '24 hours'
  GROUP BY hour, provider
  ORDER BY hour DESC;
"
```

**Resolution Steps:**

1. **Immediate (< 5 minutes):**
   ```bash
   # Enable content-size routing to shift large requests to Gemini
   # Update environment variable
   ENABLE_CONTENT_SIZE_ROUTING=true
   
   # Lower threshold to route more to Gemini
   CONTENT_SIZE_THRESHOLD_TOKENS=4000
   
   # Redeploy
   vercel --prod
   ```

2. **Short-term (< 1 hour):**
   ```bash
   # Increase throttle buffer to be more conservative
   THROTTLE_BUFFER_PERCENTAGE=25
   
   # Increase queue size to buffer more requests
   REQUEST_QUEUE_MAX_SIZE=200
   ```

3. **Long-term (< 1 day):**
   - Analyze traffic patterns to identify peak hours
   - Consider upgrading to Groq paid tier
   - Implement request batching for non-interactive features
   - Add caching layer for repeated requests

**Prevention:**
- Monitor rate limit usage proactively
- Set alerts at 70% and 85% thresholds
- Enable predictive throttling
- Use content-size routing by default

---

### Issue 2: High Fallback Rate

**Symptoms:**
- Many requests using Gemini instead of Groq
- High costs despite Groq being primary provider
- Fallback counter increasing rapidly
- Logs showing frequent fallback events

**Root Causes:**
- Groq service degradation or outages
- Rate limits being hit frequently
- Network connectivity issues
- Groq API returning errors

**Diagnosis:**
```bash
# Check fallback statistics
curl https://yourdomain.com/api/llm/metrics | jq '.fallbacks'

# Query fallback reasons
psql $DATABASE_URL -c "
  SELECT 
    errorCode,
    COUNT(*) as count,
    AVG(latencyMs) as avg_latency
  FROM llm_requests
  WHERE fallbackUsed = true
    AND timestamp >= NOW() - INTERVAL '1 hour'
  GROUP BY errorCode
  ORDER BY count DESC;
"

# Check Groq health status
curl https://yourdomain.com/api/llm/status | jq '.primary.healthy'
```

**Resolution Steps:**

1. **If due to rate limits:**
   - Follow "Rate Limit Exceeded" resolution above
   - Increase throttle buffer
   - Enable content-size routing

2. **If due to Groq service issues:**
   ```bash
   # Check Groq status page
   curl https://status.groq.com/api/v2/status.json
   
   # Temporarily increase fallback to Gemini
   # This is automatic, but you can force it:
   LLM_MODEL_MAPPING='{"chat":{"provider":"gemini",...}}'
   
   # Wait for Groq to recover, monitor health checks
   watch -n 30 'curl -s https://yourdomain.com/api/llm/status | jq .primary.healthy'
   ```

3. **If due to network issues:**
   - Check network connectivity to Groq API
   - Review firewall rules
   - Check DNS resolution
   - Verify TLS/SSL certificates

**Prevention:**
- Monitor Groq service status proactively
- Set up alerts for fallback rate > 10%
- Maintain healthy fallback provider (Gemini)
- Test fallback mechanism regularly

---

### Issue 3: Request Queue Buildup

**Symptoms:**
- Queue depth increasing in `/api/llm/status`
- Slow response times for users
- HTTP 202 responses with long wait times
- Eventually HTTP 503 when queue is full

**Root Causes:**
- Request rate exceeding processing capacity
- Throttling too aggressive
- Provider latency increased
- System under heavy load

**Diagnosis:**
```bash
# Check queue depth
curl https://yourdomain.com/api/llm/status | jq '.queueDepth'

# Check queue by priority
redis-cli -u $REDIS_URL ZCARD queue:requests:high
redis-cli -u $REDIS_URL ZCARD queue:requests:medium
redis-cli -u $REDIS_URL ZCARD queue:requests:low

# Check provider latency
curl https://yourdomain.com/api/llm/metrics | jq '.performance'
```

**Resolution Steps:**

1. **Immediate:**
   ```bash
   # Reduce throttle buffer to allow more throughput
   THROTTLE_BUFFER_PERCENTAGE=10
   
   # Increase queue expiration to give more time
   REQUEST_QUEUE_EXPIRATION_MS=60000
   
   # Redeploy
   vercel --prod
   ```

2. **If queue continues growing:**
   ```bash
   # Enable degraded mode manually to reduce load
   # This disables low-priority features
   # (Normally automatic at 90% rate limit)
   
   # Check if degraded mode is active
   curl https://yourdomain.com/api/llm/status | jq '.degradedMode'
   
   # If not, consider temporarily disabling low-priority endpoints
   LLM_MODEL_MAPPING='{"rewrite":{"provider":"gemini","priority":"low"},...}'
   ```

3. **Long-term:**
   - Scale horizontally (add more instances)
   - Optimize request processing
   - Implement request prioritization more aggressively
   - Add caching for repeated requests

**Prevention:**
- Monitor queue depth continuously
- Set alerts at 50 and 75 requests
- Load test regularly to understand capacity
- Implement auto-scaling based on queue depth

---

### Issue 4: Redis Connection Failures

**Symptoms:**
- Errors mentioning "Redis connection failed"
- System in degraded mode
- Rate limiting not working correctly
- Queue not functioning

**Root Causes:**
- Redis server down or unreachable
- Network connectivity issues
- Redis authentication failure
- Redis out of memory

**Diagnosis:**
```bash
# Test Redis connectivity
redis-cli -u $REDIS_URL ping

# Check Redis memory usage
redis-cli -u $REDIS_URL INFO memory

# Check Redis connection count
redis-cli -u $REDIS_URL INFO clients

# Check application logs
vercel logs --follow | grep -i redis
```

**Resolution Steps:**

1. **Immediate:**
   ```bash
   # System automatically falls back to in-memory rate limiting
   # Verify system is still processing requests
   curl https://yourdomain.com/api/llm/status
   
   # Check if requests are being processed
   curl -X POST https://yourdomain.com/api/chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"test"}]}'
   ```

2. **Fix Redis:**
   ```bash
   # If Redis is down, restart it
   sudo systemctl restart redis
   
   # Or for managed Redis, check provider dashboard
   
   # Verify Redis is accessible
   redis-cli -u $REDIS_URL ping
   
   # Clear old data if memory is full
   redis-cli -u $REDIS_URL FLUSHDB
   ```

3. **Restore full functionality:**
   ```bash
   # Restart application to reconnect to Redis
   vercel --prod
   
   # Verify Redis is being used
   redis-cli -u $REDIS_URL KEYS "ratelimit:*"
   ```

**Prevention:**
- Monitor Redis health continuously
- Set up Redis replication for high availability
- Configure Redis persistence (RDB + AOF)
- Set appropriate maxmemory and eviction policy
- Use managed Redis service with automatic failover

---

### Issue 5: High Costs

**Symptoms:**
- Cost alert triggered
- High Gemini API usage
- Costs exceeding budget
- Unexpected charges

**Root Causes:**
- High fallback rate to Gemini (expensive)
- Content-size routing disabled
- Large requests going to Gemini
- High traffic volume

**Diagnosis:**
```bash
# Check cost breakdown
curl https://yourdomain.com/api/llm/metrics | jq '.costs'

# Query cost by feature
psql $DATABASE_URL -c "
  SELECT 
    feature,
    provider,
    COUNT(*) as requests,
    SUM(estimatedCost) as total_cost,
    AVG(inputTokens + outputTokens) as avg_tokens
  FROM llm_requests
  WHERE timestamp >= NOW() - INTERVAL '7 days'
  GROUP BY feature, provider
  ORDER BY total_cost DESC;
"

# Check for large requests
psql $DATABASE_URL -c "
  SELECT 
    feature,
    provider,
    inputTokens,
    outputTokens,
    estimatedCost
  FROM llm_requests
  WHERE estimatedCost > 0.10
    AND timestamp >= NOW() - INTERVAL '24 hours'
  ORDER BY estimatedCost DESC
  LIMIT 20;
"
```

**Resolution Steps:**

1. **Immediate cost reduction:**
   ```bash
   # Enable content-size routing to maximize Groq usage
   ENABLE_CONTENT_SIZE_ROUTING=true
   
   # Lower threshold to route more to Groq (free)
   CONTENT_SIZE_THRESHOLD_TOKENS=7000
   
   # Ensure Groq is primary provider
   PRIMARY_LLM_PROVIDER=groq
   
   # Redeploy
   vercel --prod
   ```

2. **Reduce fallback rate:**
   - Follow "High Fallback Rate" resolution above
   - Ensure rate limits are not being exceeded
   - Check Groq health status

3. **Optimize token usage:**
   ```bash
   # Reduce max tokens for responses
   # Update model mapping to use smaller models where possible
   LLM_MODEL_MAPPING='{"flashcards":{"model":"llama-3.1-8b-instant"},...}'
   
   # Implement response caching for repeated requests
   ```

4. **Set cost limits:**
   ```bash
   # Lower cost alert threshold
   COST_ALERT_THRESHOLD_USD=5.00
   
   # Implement daily cost limits in application logic
   ```

**Prevention:**
- Monitor costs daily
- Set up cost alerts at multiple thresholds
- Maximize Groq free tier usage
- Implement request caching
- Optimize prompts to reduce token usage

---

### Issue 6: Degraded Mode Activated

**Symptoms:**
- HTTP 206 responses with degradation notice
- Low-priority features disabled
- Reduced response quality
- Streaming disabled

**Root Causes:**
- Both providers exceeding 90% rate limit
- System protecting against complete exhaustion
- Traffic spike

**Diagnosis:**
```bash
# Check if degraded mode is active
curl https://yourdomain.com/api/llm/status | jq '.degradedMode'

# Check rate limit usage for both providers
curl https://yourdomain.com/api/llm/status | jq '.primary.rateLimitUsage, .fallback'

# Check recent traffic
psql $DATABASE_URL -c "
  SELECT 
    DATE_TRUNC('minute', timestamp) as minute,
    COUNT(*) as requests
  FROM llm_requests
  WHERE timestamp >= NOW() - INTERVAL '1 hour'
  GROUP BY minute
  ORDER BY minute DESC
  LIMIT 20;
"
```

**Resolution Steps:**

1. **Wait for rate limits to recover:**
   ```bash
   # Degraded mode automatically exits when usage drops below 70%
   # Monitor status
   watch -n 30 'curl -s https://yourdomain.com/api/llm/status | jq .degradedMode'
   ```

2. **Reduce traffic:**
   - Temporarily disable non-critical features
   - Implement request throttling at application level
   - Add rate limiting per user

3. **Increase capacity:**
   - Consider upgrading to Groq paid tier
   - Add more provider options
   - Implement request batching

**Prevention:**
- Monitor rate limit usage proactively
- Set alerts before reaching 90%
- Implement predictive throttling
- Load test to understand capacity limits

---

## Alert Thresholds and Responses

### Alert: Rate Limit Usage > 70%

**Severity:** Warning  
**Response Time:** 15 minutes

**Actions:**
1. Check `/api/llm/status` for current usage
2. Review recent traffic patterns
3. Enable content-size routing if not already enabled
4. Monitor for continued increase

**Escalation:** If usage reaches 85%, escalate to on-call engineer

---

### Alert: Rate Limit Usage > 85%

**Severity:** High  
**Response Time:** 5 minutes

**Actions:**
1. Immediately enable content-size routing
2. Lower content-size threshold to shift more to Gemini
3. Increase throttle buffer
4. Monitor queue depth
5. Prepare for potential degraded mode

**Escalation:** Page on-call engineer immediately

---

### Alert: Queue Depth > 50

**Severity:** Warning  
**Response Time:** 10 minutes

**Actions:**
1. Check queue depth by priority
2. Review provider latency
3. Check for rate limit issues
4. Monitor for continued growth

**Escalation:** If queue reaches 75, escalate to on-call engineer

---

### Alert: Queue Depth > 75

**Severity:** High  
**Response Time:** 5 minutes

**Actions:**
1. Reduce throttle buffer to increase throughput
2. Check provider health
3. Consider temporarily disabling low-priority features
4. Scale horizontally if possible

**Escalation:** Page on-call engineer immediately

---

### Alert: Fallback Rate > 10%

**Severity:** Warning  
**Response Time:** 15 minutes

**Actions:**
1. Check fallback reasons in metrics
2. Review Groq health status
3. Check for rate limit issues
4. Verify network connectivity

**Escalation:** If fallback rate reaches 25%, escalate to on-call engineer

---

### Alert: Fallback Rate > 25%

**Severity:** High  
**Response Time:** 5 minutes

**Actions:**
1. Check Groq service status
2. Review error logs for patterns
3. Consider temporarily switching to Gemini as primary
4. Investigate root cause

**Escalation:** Page on-call engineer immediately

---

### Alert: Provider Unhealthy > 5 minutes

**Severity:** Critical  
**Response Time:** Immediate

**Actions:**
1. Check provider service status
2. Verify network connectivity
3. Review error logs
4. Switch to fallback provider if needed
5. Contact provider support if necessary

**Escalation:** Page on-call engineer and escalate to senior engineer

---

### Alert: Daily Cost > Threshold

**Severity:** Warning  
**Response Time:** 30 minutes

**Actions:**
1. Check cost breakdown by provider and feature
2. Verify content-size routing is enabled
3. Check fallback rate
4. Review for unusual traffic patterns

**Escalation:** Notify engineering manager

---

### Alert: Redis Connection Failed

**Severity:** High  
**Response Time:** 5 minutes

**Actions:**
1. Check Redis server status
2. Verify network connectivity
3. Check Redis memory usage
4. System will degrade gracefully with in-memory rate limiting
5. Restore Redis connection ASAP

**Escalation:** Page on-call engineer immediately

---

### Alert: Error Rate > 5%

**Severity:** High  
**Response Time:** 5 minutes

**Actions:**
1. Review error logs for patterns
2. Check provider health
3. Verify configuration
4. Check for deployment issues
5. Consider rollback if recent deployment

**Escalation:** Page on-call engineer immediately

---

## Scaling Considerations

### Horizontal Scaling

**When to Scale:**
- Queue depth consistently > 30
- Rate limit usage consistently > 80%
- Response times increasing
- Traffic growing steadily

**How to Scale:**

1. **Add more application instances:**
   ```bash
   # Vercel example
   vercel scale <deployment-url> <min-instances> <max-instances>
   
   # Example: Scale to 3-10 instances
   vercel scale production 3 10
   ```

2. **Ensure Redis can handle load:**
   ```bash
   # Check Redis connection count
   redis-cli -u $REDIS_URL INFO clients
   
   # Increase Redis max connections if needed
   redis-cli -u $REDIS_URL CONFIG SET maxclients 10000
   ```

3. **Monitor distributed rate limiting:**
   - Verify rate limits are enforced correctly across instances
   - Check for race conditions in counter increments
   - Monitor Redis latency

**Considerations:**
- Redis becomes critical single point of failure
- Rate limiting must be distributed correctly
- Queue state must be shared across instances
- Health checks must be coordinated

---

### Vertical Scaling

**When to Scale:**
- High CPU usage on application instances
- Memory pressure
- Slow request processing

**How to Scale:**

1. **Increase instance resources:**
   ```bash
   # Update instance type/size in deployment configuration
   # Vercel automatically handles this based on plan
   ```

2. **Optimize application:**
   - Profile hot paths
   - Optimize database queries
   - Implement caching
   - Reduce memory allocations

---

### Redis Scaling

**When to Scale:**
- Redis memory usage > 80%
- Redis CPU usage high
- Slow Redis operations

**How to Scale:**

1. **Increase Redis memory:**
   ```bash
   # For managed Redis, upgrade plan
   # For self-hosted, increase maxmemory
   redis-cli -u $REDIS_URL CONFIG SET maxmemory 512mb
   ```

2. **Implement Redis clustering:**
   - Use Redis Cluster for horizontal scaling
   - Shard data across multiple Redis nodes
   - Ensure application supports cluster mode

3. **Optimize Redis usage:**
   ```bash
   # Set appropriate eviction policy
   redis-cli -u $REDIS_URL CONFIG SET maxmemory-policy allkeys-lru
   
   # Reduce key TTLs where possible
   # Clean up old data regularly
   ```

---

### Database Scaling

**When to Scale:**
- Slow cost tracking queries
- High database CPU usage
- Large table sizes

**How to Scale:**

1. **Add database indexes:**
   ```sql
   CREATE INDEX CONCURRENTLY idx_llm_requests_timestamp_provider 
   ON llm_requests(timestamp, provider);
   ```

2. **Implement table partitioning:**
   ```sql
   -- Partition by month for better query performance
   CREATE TABLE llm_requests_2024_01 PARTITION OF llm_requests
   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
   ```

3. **Archive old data:**
   ```sql
   -- Move data older than 90 days to archive table
   INSERT INTO llm_requests_archive
   SELECT * FROM llm_requests
   WHERE timestamp < NOW() - INTERVAL '90 days';
   
   DELETE FROM llm_requests
   WHERE timestamp < NOW() - INTERVAL '90 days';
   ```

---

## Provider Quota Management

### Groq Cloud Free Tier

**Limits:**
- 30 requests per minute
- 14,400 requests per day
- No cost

**Monitoring:**
```bash
# Check current usage
curl https://yourdomain.com/api/llm/status | jq '.primary.rateLimitUsage'

# Check daily usage trend
psql $DATABASE_URL -c "
  SELECT 
    DATE(timestamp) as date,
    COUNT(*) as requests
  FROM llm_requests
  WHERE provider = 'groq'
    AND timestamp >= NOW() - INTERVAL '7 days'
  GROUP BY date
  ORDER BY date DESC;
"
```

**Optimization Strategies:**
1. Enable content-size routing to shift large requests to Gemini
2. Implement request caching for repeated queries
3. Use smaller models (Llama 3.1 8B) for simple tasks
4. Batch non-interactive requests during off-peak hours

**Upgrade Considerations:**
- If consistently hitting daily limit
- If queue depth frequently > 50
- If fallback rate > 20%
- If business requires guaranteed capacity

---

### Google Gemini API

**Limits:**
- Varies by tier (check Google Cloud Console)
- Pay-per-use pricing

**Monitoring:**
```bash
# Check Gemini usage
curl https://yourdomain.com/api/llm/metrics | jq '.costs.gemini'

# Check Gemini request volume
psql $DATABASE_URL -c "
  SELECT 
    DATE(timestamp) as date,
    COUNT(*) as requests,
    SUM(estimatedCost) as cost
  FROM llm_requests
  WHERE provider = 'gemini'
    AND timestamp >= NOW() - INTERVAL '7 days'
  GROUP BY date
  ORDER BY date DESC;
"
```

**Cost Optimization:**
1. Maximize Groq usage for small requests
2. Use content-size routing effectively
3. Reduce fallback rate
4. Optimize prompts to reduce token usage
5. Implement response caching

---

### Quota Exhaustion Response

**If Groq quota exhausted:**
1. System automatically falls back to Gemini
2. Monitor costs closely
3. Consider temporary rate limiting at application level
4. Wait for quota reset (minute/day boundary)

**If both quotas exhausted:**
1. System returns HTTP 503 Service Unavailable
2. Implement application-level rate limiting
3. Queue requests for later processing
4. Consider emergency quota increase with providers

---

## Incident Response Procedures

### Severity Levels

**P0 - Critical:**
- Complete service outage
- All providers down
- Data loss or corruption
- Security breach

**P1 - High:**
- Partial service outage
- One provider down
- High error rate (> 10%)
- Performance severely degraded

**P2 - Medium:**
- Degraded performance
- High fallback rate
- Queue buildup
- Cost overruns

**P3 - Low:**
- Minor issues
- Warnings in logs
- Non-critical alerts

### Incident Response Steps

1. **Detect and Alert:**
   - Automated monitoring triggers alert
   - On-call engineer notified

2. **Assess:**
   - Check `/api/llm/status` and `/api/llm/metrics`
   - Review logs for errors
   - Determine severity level

3. **Mitigate:**
   - Follow runbook procedures for specific issue
   - Implement temporary fixes
   - Communicate status to stakeholders

4. **Resolve:**
   - Implement permanent fix
   - Verify system is stable
   - Monitor for recurrence

5. **Post-Mortem:**
   - Document incident timeline
   - Identify root cause
   - Create action items to prevent recurrence
   - Update runbook with learnings

---

## Performance Tuning

### Latency Optimization

**Target Metrics:**
- First token latency < 500ms (Groq)
- Total request latency < 10s (structured output)
- Router overhead < 50ms

**Optimization Techniques:**

1. **Reduce network latency:**
   - Deploy close to provider regions
   - Use CDN for static assets
   - Optimize DNS resolution

2. **Optimize Redis operations:**
   ```bash
   # Use pipelining for multiple operations
   # Reduce round trips
   
   # Monitor Redis latency
   redis-cli -u $REDIS_URL --latency
   ```

3. **Cache provider configuration:**
   - Load config once at startup
   - Avoid repeated environment variable reads
   - Cache model mappings in memory

4. **Optimize database queries:**
   - Add appropriate indexes
   - Use connection pooling
   - Implement query caching

---

### Throughput Optimization

**Target Metrics:**
- Handle 25 req/min sustained (Groq limit with buffer)
- Queue processing < 1s per request
- Zero request drops

**Optimization Techniques:**

1. **Optimize throttle controller:**
   ```bash
   # Reduce buffer for higher throughput
   THROTTLE_BUFFER_PERCENTAGE=10
   
   # Increase burst size
   ```

2. **Implement request batching:**
   - Batch non-interactive requests
   - Process during off-peak hours
   - Use lower priority for batch requests

3. **Optimize queue processing:**
   - Process multiple requests concurrently
   - Implement priority-based processing
   - Reduce queue expiration time

---

### Memory Optimization

**Target Metrics:**
- Application memory < 512 MB
- Redis memory < 256 MB
- No memory leaks

**Optimization Techniques:**

1. **Monitor memory usage:**
   ```bash
   # Check application memory
   vercel logs --follow | grep -i memory
   
   # Check Redis memory
   redis-cli -u $REDIS_URL INFO memory
   ```

2. **Optimize Redis usage:**
   ```bash
   # Set appropriate eviction policy
   redis-cli -u $REDIS_URL CONFIG SET maxmemory-policy allkeys-lru
   
   # Reduce key TTLs
   # Clean up old data
   ```

3. **Optimize application:**
   - Avoid memory leaks in event handlers
   - Clean up old queue entries
   - Implement garbage collection tuning

---

## Maintenance Windows

### Planned Maintenance

**Frequency:** Monthly  
**Duration:** 1-2 hours  
**Best Time:** Low-traffic hours (2-4 AM local time)

**Maintenance Tasks:**
1. Update dependencies
2. Apply security patches
3. Rotate API keys
4. Clean up old data
5. Optimize database
6. Review and update configuration

**Procedure:**
1. Announce maintenance window 48 hours in advance
2. Enable maintenance mode (optional)
3. Perform maintenance tasks
4. Run smoke tests
5. Monitor for issues
6. Announce completion

---

## Emergency Contacts

**On-Call Engineer:** [Contact info]  
**Engineering Manager:** [Contact info]  
**DevOps Team:** [Contact info]

**Provider Support:**
- Groq Support: support@groq.com
- Google Cloud Support: [Support portal]
- Redis Support: [Support portal]

**Escalation Path:**
1. On-call engineer (immediate)
2. Engineering manager (15 minutes)
3. Senior engineer (30 minutes)
4. CTO (1 hour for P0 incidents)
