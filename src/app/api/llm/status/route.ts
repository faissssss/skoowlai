import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createLLMRouter, getLLMRequestLogs, refreshLLMProviderHealth } from '@/lib/llm/service';

/**
 * GET /api/llm/status
 * 
 * Returns current LLM system status including:
 * - Provider health status
 * - Rate limit usage
 * - Queue depth
 * - Degraded mode status
 * 
 * SECURITY: Requires admin authentication
 */
export async function GET() {
  // SECURITY: Require admin authentication
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  try {
    const router = createLLMRouter(30000);
    await refreshLLMProviderHealth();
    
    // Get provider status
    const status = await router.getProviderStatus();
    
    // Get logs to calculate content size routing metrics
    const logs = getLLMRequestLogs();
    
    // Calculate content size routing statistics
    const contentSizeStats = {
      totalRequests: logs.length,
      routedToGroq: logs.filter(l => l.provider === 'groq' && l.contentSizeRoutingReason).length,
      routedToGemini: logs.filter(l => l.provider === 'gemini' && l.contentSizeRoutingReason).length,
      averageTokensByFeature: {} as Record<string, number>,
      routingReasons: {} as Record<string, number>,
    };
    
    // Calculate average tokens per feature
    const tokensByFeature: Record<string, number[]> = {};
    for (const log of logs) {
      if (log.estimatedTokens !== undefined) {
        if (!tokensByFeature[log.feature]) {
          tokensByFeature[log.feature] = [];
        }
        tokensByFeature[log.feature].push(log.estimatedTokens);
      }
      
      // Count routing reasons
      if (log.contentSizeRoutingReason) {
        contentSizeStats.routingReasons[log.contentSizeRoutingReason] = 
          (contentSizeStats.routingReasons[log.contentSizeRoutingReason] || 0) + 1;
      }
    }
    
    for (const [feature, tokens] of Object.entries(tokensByFeature)) {
      const avg = tokens.reduce((sum, t) => sum + t, 0) / tokens.length;
      contentSizeStats.averageTokensByFeature[feature] = Math.round(avg);
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'operational',
      providers: {
        primary: {
          name: status.primary.provider,
          healthy: status.primary.healthy,
          rateLimit: {
            rpm: {
              current: status.primary.rateLimit.rpm.current,
              limit: status.primary.rateLimit.rpm.limit,
              remaining: status.primary.rateLimit.rpm.remaining,
              percentage: status.primary.rateLimit.rpm.percentage,
            },
            rpd: {
              current: status.primary.rateLimit.rpd.current,
              limit: status.primary.rateLimit.rpd.limit,
              remaining: status.primary.rateLimit.rpd.remaining,
              percentage: status.primary.rateLimit.rpd.percentage,
            },
          },
        },
        fallback: status.fallback ? {
          name: status.fallback.provider,
          healthy: status.fallback.healthy,
          rateLimit: {
            rpm: {
              current: status.fallback.rateLimit.rpm.current,
              limit: status.fallback.rateLimit.rpm.limit,
              remaining: status.fallback.rateLimit.rpm.remaining,
              percentage: status.fallback.rateLimit.rpm.percentage,
            },
            rpd: {
              current: status.fallback.rateLimit.rpd.current,
              limit: status.fallback.rateLimit.rpd.limit,
              remaining: status.fallback.rateLimit.rpd.remaining,
              percentage: status.fallback.rateLimit.rpd.percentage,
            },
          },
        } : undefined,
      },
      degradedMode: status.degradedMode,
      queueDepth: status.queueDepth,
      contentSizeRouting: contentSizeStats,
    });
  } catch (error) {
    console.error('[LLM Status] Error fetching status:', error);
    
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: 'Failed to fetch LLM status',
      },
      { status: 500 }
    );
  }
}
