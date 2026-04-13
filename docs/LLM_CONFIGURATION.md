# LLM Configuration Guide

This document explains the LLM provider configuration options for handling various content sizes, including long-form content like podcasts.

## Environment Variables

### Core Provider Settings

```bash
PRIMARY_LLM_PROVIDER=groq
FALLBACK_LLM_PROVIDER=gemini
ENABLE_LLM_FALLBACK=true
```

- **PRIMARY_LLM_PROVIDER**: The main LLM provider to use (`groq` or `gemini`)
- **FALLBACK_LLM_PROVIDER**: Backup provider if primary fails
- **ENABLE_LLM_FALLBACK**: Enable automatic fallback to secondary provider

### Content Size Routing

```bash
ENABLE_CONTENT_SIZE_ROUTING=true
CONTENT_SIZE_THRESHOLD_TOKENS=100000
GROQ_CONTEXT_LIMIT_TOKENS=128000
```

- **ENABLE_CONTENT_SIZE_ROUTING**: Enable intelligent routing based on content size
- **CONTENT_SIZE_THRESHOLD_TOKENS**: Token threshold for routing decisions (default: 100,000)
  - Content below this threshold → Groq (cost-effective, fast)
  - Content above this threshold → Gemini (large context window)
- **GROQ_CONTEXT_LIMIT_TOKENS**: Maximum tokens Groq can handle (default: 128,000)
  - Llama 3.3 70B supports up to 128k tokens
  - Content exceeding this limit will automatically route to Gemini

## Content Size Estimates

### Podcast Duration to Token Estimation

| Duration | Words | Characters | Estimated Tokens |
|----------|-------|------------|------------------|
| 30 min   | 4,500 | 22,500     | ~5,625           |
| 1 hour   | 9,000 | 45,000     | ~11,250          |
| 2 hours  | 18,000| 90,000     | ~22,500          |
| 3 hours  | 27,000| 135,000    | ~33,750          |

**Calculation:**
- Average speaking rate: 150 words/minute
- Average word length: 5 characters
- Token estimation: characters / 4

### Recommended Settings by Use Case

#### Standard Use (Most Content)
```bash
ENABLE_CONTENT_SIZE_ROUTING=true
CONTENT_SIZE_THRESHOLD_TOKENS=100000
GROQ_CONTEXT_LIMIT_TOKENS=128000
```
- Handles up to 3-hour podcasts on Groq
- Only routes to Gemini for extremely large content (>128k tokens)
- Cost-effective for most use cases

#### High-Volume Long-Form Content
```bash
ENABLE_CONTENT_SIZE_ROUTING=true
CONTENT_SIZE_THRESHOLD_TOKENS=50000
GROQ_CONTEXT_LIMIT_TOKENS=128000
```
- Routes longer content (>50k tokens) to Gemini earlier
- Useful if Groq rate limits are being hit frequently
- Balances load between providers

#### Groq-Only (Cost Optimization)
```bash
ENABLE_CONTENT_SIZE_ROUTING=false
CONTENT_SIZE_THRESHOLD_TOKENS=100000
GROQ_CONTEXT_LIMIT_TOKENS=128000
```
- Forces all content to Groq regardless of size
- Maximum cost savings
- May fail on content exceeding 128k tokens

#### Gemini-Only (Maximum Context)
```bash
ENABLE_CONTENT_SIZE_ROUTING=true
CONTENT_SIZE_THRESHOLD_TOKENS=1000
GROQ_CONTEXT_LIMIT_TOKENS=128000
```
- Routes almost all content to Gemini
- Useful for testing or when Groq is unavailable
- Higher cost but handles any content size

## Provider Capabilities

### Groq (Llama 3.3 70B)
- **Context Window**: 128,000 tokens
- **Speed**: Very fast (optimized inference)
- **Cost**: Lower cost per token
- **Best For**: Most content, including 2-3 hour podcasts
- **Limitations**: Fixed context window, rate limits

### Gemini (2.5 Flash)
- **Context Window**: 1,000,000+ tokens
- **Speed**: Fast
- **Cost**: Higher cost per token
- **Best For**: Extremely large content (>128k tokens)
- **Limitations**: May experience high demand (503 errors)

## Troubleshooting

### Issue: YouTube videos failing with "high demand" error
**Cause**: Content is being routed to Gemini, which is experiencing 503 errors

**Solution 1** (Recommended): Increase threshold to use Groq
```bash
CONTENT_SIZE_THRESHOLD_TOKENS=100000
```

**Solution 2**: Disable content size routing
```bash
ENABLE_CONTENT_SIZE_ROUTING=false
```

### Issue: Content exceeds Groq context limit
**Symptom**: Errors about context length

**Solution**: Content will automatically route to Gemini if it exceeds `GROQ_CONTEXT_LIMIT_TOKENS`

### Issue: High costs
**Cause**: Too much content routing to Gemini

**Solution**: Increase threshold to keep more content on Groq
```bash
CONTENT_SIZE_THRESHOLD_TOKENS=100000
```

## Migration and Rollback

### Global Rollback to Gemini
```bash
LLM_MIGRATION_ENABLED=false
```
Routes ALL endpoints to Gemini, bypassing the router entirely.

### Per-Endpoint Override
```bash
LLM_ENDPOINT_OVERRIDES={"generate":"gemini","chat":"groq"}
```
Override specific endpoints to use a particular provider.

## Monitoring

Check current provider status and routing decisions in logs:
- Look for `[LLM Router]` log entries
- Content size routing reasons are logged with each request
- Monitor token estimates vs actual usage

## Best Practices

1. **Start with recommended settings** (100k threshold)
2. **Monitor your usage patterns** to optimize thresholds
3. **Keep fallback enabled** for reliability
4. **Test with sample content** before deploying changes
5. **Document any custom configurations** for your team
