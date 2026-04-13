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

### Content Size Routing (Production-Ready Configuration)

```bash
ENABLE_CONTENT_SIZE_ROUTING=true
CONTENT_SIZE_THRESHOLD_TOKENS=20000
GROQ_CONTEXT_LIMIT_TOKENS=120000
```

- **ENABLE_CONTENT_SIZE_ROUTING**: Enable intelligent routing based on content size
- **CONTENT_SIZE_THRESHOLD_TOKENS**: Token threshold for routing decisions (default: 20,000)
  - **≤20,000 tokens** → Groq (fast, within free tier TPM limit)
  - **>20,000 tokens** → Gemini (reliable, 1M TPM free tier)
- **GROQ_CONTEXT_LIMIT_TOKENS**: Maximum tokens Groq can handle (default: 120,000)
  - Set to 120k (not 128k) to leave 8k buffer for output generation
  - Content exceeding this limit will automatically route to Gemini

### Why 20,000 Token Threshold?

**Groq Free Tier Constraint:**
- **TPM Limit**: 20,000 tokens per minute (input + output combined)
- **Safe Input**: 20,000 tokens leaves headroom for output (~3-5k tokens)
- **Predictability**: No surprise rate limits during user sessions
- **Single Request Safety**: Ensures each request stays within TPM budget

**Gemini Free Tier Advantage:**
- **TPM Limit**: 1,000,000 tokens per minute (practically unlimited)
- **Reliability**: Handles large content without rate limit concerns
- **Quality**: Superior large-context understanding

**Trade-off:**
- ✅ Gain: Predictable, production-ready behavior
- ✅ Gain: No mid-session rate limit errors
- ⚠️ Loss: Medium content (20-50k tokens) uses Gemini instead of Groq's speed
- ✅ Net: Reliability > Speed for production use

## Content Size Estimates

### Content Type to Token Mapping

| Content Type | Typical Size | Tokens | Provider | Reasoning |
|--------------|--------------|--------|----------|-----------|
| **Short Content (Groq Territory)** |
| Article/Blog | 2-5k words | 2,500-6,250 | Groq | Fast processing, well within limit |
| Short PDF (5-15 pages) | 2.5-7.5k words | 3,125-9,375 | Groq | Quick turnaround |
| 30min Podcast | 4,500 words | ~5,625 | Groq | Efficient processing |
| 1hr Podcast | 9,000 words | ~11,250 | Groq | Within safe threshold |
| Medium PDF (15-20 pages) | 7.5-10k words | 9,375-12,500 | Groq | Still fast |
| **Large Content (Gemini Territory)** |
| 1.5hr Podcast | 13,500 words | ~16,875 | Groq | Near threshold |
| 2hr Podcast | 18,000 words | ~22,500 | Gemini | Exceeds 20k threshold |
| Medium PDF (20-50 pages) | 10-25k words | 12,500-31,250 | Gemini | Better comprehension |
| Large PDF (50-100 pages) | 25-50k words | 31,250-62,500 | Gemini | Large context handling |
| 3hr Podcast | 27,000 words | ~33,750 | Gemini | Long-form content |
| Book (100-300 pages) | 50-150k words | 62,500-187,500 | Gemini | Exceeds Groq limit |
| 5hr+ Podcast | 45,000+ words | ~56,250+ | Gemini | Very large content |

**Calculation:**
- Average speaking rate: 150 words/minute
- Average word length: 5 characters
- Token estimation: characters / 4

### Threshold Decision Point

```
┌─────────────────────────────────────────────────────────┐
│ 20,000 Token Threshold (Production-Ready)              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  0 - 20,000 tokens (≤80 pages or ≤1.5hr podcast)       │
│  ├─ Provider: GROQ                                      │
│  ├─ Speed: ⚡ Very Fast (~20-30 seconds)                │
│  ├─ TPM Safety: ✅ Within 20k free tier limit          │
│  └─ Use Cases: Articles, short-medium docs, <1.5hr     │
│                                                          │
│  20,001 - 120,000 tokens (80-480 pages or 1.5-8hr)     │
│  ├─ Provider: GEMINI                                    │
│  ├─ Speed: Fast (~30-60 seconds)                        │
│  ├─ TPM Safety: ✅ Well within 1M free tier limit      │
│  ├─ Quality: ⭐ Superior large-context understanding    │
│  └─ Use Cases: Long docs, 2-8hr podcasts, books        │
│                                                          │
│  120,001+ tokens (480+ pages or 8+ hr podcasts)        │
│  ├─ Provider: GEMINI (automatic)                        │
│  ├─ Reason: Exceeds Groq context limit                 │
│  ├─ TPM Safety: ✅ Still within 1M limit               │
│  └─ Use Cases: Very long books, multi-hour content     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Recommended Settings by Use Case

#### Production-Ready Hybrid (Recommended)
```bash
ENABLE_CONTENT_SIZE_ROUTING=true
CONTENT_SIZE_THRESHOLD_TOKENS=20000
GROQ_CONTEXT_LIMIT_TOKENS=120000
```
- **Philosophy**: Reliability over speed
- **Groq**: Short content (≤20k tokens, ≤1.5hr podcasts)
  - Fast processing
  - No TPM rate limit concerns
  - Predictable behavior
- **Gemini**: Everything else (>20k tokens)
  - Reliable large-context handling
  - 1M TPM free tier (practically unlimited)
  - Superior quality for long-form content
- **Best for**: Production environments, user-facing apps
- **Trade-off**: Medium content uses Gemini (slightly slower) for reliability

#### Aggressive Groq Usage (Speed Optimized)
```bash
ENABLE_CONTENT_SIZE_ROUTING=true
CONTENT_SIZE_THRESHOLD_TOKENS=50000
GROQ_CONTEXT_LIMIT_TOKENS=120000
```
- **Philosophy**: Maximize Groq's speed advantage
- Handles up to 4-hour podcasts on Groq
- Processes 50-page PDFs on Groq
- **Risk**: May hit TPM limits with concurrent requests
- **Best for**: Low-traffic apps, development/testing

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
- **Context Window**: 128,000 tokens (120k safe limit with output buffer)
- **Speed**: ⚡ Very fast (~20-30 seconds for most content)
- **Free Tier TPM**: 20,000 tokens/minute (input + output)
- **Free Tier RPM**: 30 requests/minute
- **Free Tier RPD**: 14,400 requests/day
- **Cost (Paid)**: $0.59/1M input tokens, $0.79/1M output tokens
- **Best For**: Short-medium content (≤20k tokens)
- **Limitations**: TPM limit requires careful threshold management

### Gemini (2.5 Flash)
- **Context Window**: 1,048,576 tokens (1M+)
- **Speed**: Fast (~30-60 seconds)
- **Free Tier TPM**: 1,000,000 tokens/minute (practically unlimited)
- **Free Tier RPM**: 15 requests/minute
- **Free Tier RPD**: 1,500 requests/day
- **Cost (Paid)**: $0.075/1M tokens (<128k), $0.15/1M tokens (>128k)
- **Best For**: Large content (>20k tokens), long-form analysis
- **Limitations**: Lower RPM/RPD than Groq, occasional high demand (503 errors)

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
