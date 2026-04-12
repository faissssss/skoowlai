/**
 * Example usage of CostTracker with database storage and threshold alerts
 * 
 * This file demonstrates how to use the CostTracker module with:
 * - Database-backed storage using Prisma
 * - Threshold alerts for cost monitoring
 * - Daily and per-endpoint cost aggregation
 */

import { CostTracker, PrismaCostStorage, type CostTrackerConfig } from './costTracker';
import { db } from '../db';

// Example 1: Basic usage with database storage
export function createProductionCostTracker() {
  const storage = new PrismaCostStorage(db);
  const tracker = new CostTracker(storage);
  return tracker;
}

// Example 2: With threshold alerts
export function createCostTrackerWithAlerts(thresholdUSD: number) {
  const storage = new PrismaCostStorage(db);
  
  const config: CostTrackerConfig = {
    pricing: {
      groq: {
        inputCostPer1kTokens: 0,
        outputCostPer1kTokens: 0,
      },
      gemini: {
        inputCostPer1kTokens: 0.000075,
        outputCostPer1kTokens: 0.0003,
      },
    },
    thresholdAlerts: {
      enabled: true,
      thresholdUSD,
      onThresholdExceeded: async (provider, cost, threshold) => {
        console.warn(`⚠️ Cost threshold exceeded for ${provider}!`);
        console.warn(`Daily cost: $${cost.toFixed(4)} (threshold: $${threshold.toFixed(4)})`);
        
        // Here you could:
        // - Send an email notification
        // - Post to Slack/Discord
        // - Log to monitoring system
        // - Trigger rate limiting
      },
    },
  };
  
  return new CostTracker(storage, config);
}

// Example 3: Logging a request
export async function logLLMRequest(tracker: CostTracker) {
  const entry = await tracker.logRequest({
    timestamp: new Date(),
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    feature: 'chat',
    inputTokens: 1000,
    outputTokens: 500,
    requestId: 'req-123',
    latencyMs: 250,
    success: true,
    fallbackUsed: false,
    userId: 'user-456',
  });
  
  console.log(`Logged request ${entry.requestId} with cost $${entry.estimatedCost.toFixed(6)}`);
  return entry;
}

// Example 4: Getting cost summary
export async function getDailyCostReport(tracker: CostTracker) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  
  const geminiSummary = await tracker.getSummary('gemini', start, end);
  const groqSummary = await tracker.getSummary('groq', start, end);
  
  console.log('Daily Cost Report:');
  console.log(`Gemini: $${geminiSummary.totalCost.toFixed(4)} (${geminiSummary.totalRequests} requests)`);
  console.log(`Groq: $${groqSummary.totalCost.toFixed(4)} (${groqSummary.totalRequests} requests)`);
  
  console.log('\nCost by Feature (Gemini):');
  for (const [feature, stats] of Object.entries(geminiSummary.byFeature)) {
    console.log(`  ${feature}: $${stats.cost.toFixed(4)} (${stats.requests} requests)`);
  }
  
  return { geminiSummary, groqSummary };
}

// Example 5: Checking if threshold is exceeded
export async function checkCostThreshold(tracker: CostTracker, thresholdUSD: number) {
  const exceeded = await tracker.checkThreshold('gemini', thresholdUSD);
  
  if (exceeded) {
    console.warn(`⚠️ Daily cost threshold of $${thresholdUSD} has been exceeded!`);
    const dailyCost = await tracker.getDailyCost('gemini', new Date());
    console.warn(`Current daily cost: $${dailyCost.toFixed(4)}`);
  }
  
  return exceeded;
}
