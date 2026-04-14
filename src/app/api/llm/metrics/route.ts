import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createLLMRouter, getLLMRequestLogs } from '@/lib/llm/service';

/**
 * GET /api/llm/metrics
 * 
 * Returns LLM performance and cost metrics including:
 * - Request logs with timing and token usage
 * - Cost tracking data
 * - Performance statistics
 * 
 * SECURITY: Requires admin authentication
 */
export async function GET(request: Request) {
  // SECURITY: Require admin authentication
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get('limit') || '100', 10);
    const feature = searchParams.get('feature');
    
    type ProviderMetrics = {
      requests: number;
      successful: number;
      failed: number;
      totalLatency: number;
      inputTokens: number;
      outputTokens: number;
      avgLatency?: number;
      successRate?: number;
    };
    
    void (await createLLMRouter(30000));
    
    // Get request logs
    let logs = await getLLMRequestLogs();
    
    // Filter by feature if specified
    if (feature) {
      logs = logs.filter(log => log.feature === feature);
    }
    
    // Limit results
    logs = logs.slice(-limit);
    
    // Calculate aggregate metrics
    const totalRequests = logs.length;
    const successfulRequests = logs.filter(log => log.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    
    const totalLatency = logs.reduce((sum, log) => sum + (log.latencyMs || 0), 0);
    const avgLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;
    
    const totalInputTokens = logs.reduce((sum, log) => sum + (log.inputTokens || 0), 0);
    const totalOutputTokens = logs.reduce((sum, log) => sum + (log.outputTokens || 0), 0);
    
    // Group by provider
    const byProvider = logs.reduce<Record<string, ProviderMetrics>>((acc, log) => {
      if (!acc[log.provider]) {
        acc[log.provider] = {
          requests: 0,
          successful: 0,
          failed: 0,
          totalLatency: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
      }
      
      acc[log.provider].requests += 1;
      if (log.success) {
        acc[log.provider].successful += 1;
      } else {
        acc[log.provider].failed += 1;
      }
      acc[log.provider].totalLatency += log.latencyMs || 0;
      acc[log.provider].inputTokens += log.inputTokens || 0;
      acc[log.provider].outputTokens += log.outputTokens || 0;
      
      return acc;
    }, {});
    
    // Calculate averages per provider
    Object.keys(byProvider).forEach(provider => {
      const data = byProvider[provider];
      data.avgLatency = data.requests > 0 ? data.totalLatency / data.requests : 0;
      data.successRate = data.requests > 0 ? (data.successful / data.requests) * 100 : 0;
      // Remove totalLatency as it's no longer needed
      const { totalLatency, ...rest } = data;
      byProvider[provider] = rest as typeof data;
    });
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: Math.round(successRate * 100) / 100,
        avgLatency: Math.round(avgLatency * 100) / 100,
        totalInputTokens,
        totalOutputTokens,
      },
      byProvider,
      recentLogs: logs.map(log => ({
        requestId: log.requestId,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        provider: log.provider,
        model: log.model,
        feature: log.feature,
        success: log.success,
        latencyMs: log.latencyMs,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        error: log.error,
      })),
    });
  } catch (error) {
    console.error('[LLM Metrics] Error fetching metrics:', error);
    
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        error: 'Failed to fetch LLM metrics',
      },
      { status: 500 }
    );
  }
}
