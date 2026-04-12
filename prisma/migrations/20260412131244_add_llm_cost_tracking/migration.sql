-- CreateTable: LlmRequest - logs every individual LLM request with detailed metrics
CREATE TABLE IF NOT EXISTS "LlmRequest" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "requestId" TEXT NOT NULL,

    CONSTRAINT "LlmRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CostSummary - aggregated daily statistics per provider and feature
CREATE TABLE IF NOT EXISTS "CostSummary" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalRequests" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "avgLatencyMs" DOUBLE PRECISION NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: LlmRequest indexes for efficient querying
CREATE INDEX IF NOT EXISTS "LlmRequest_timestamp_idx" ON "LlmRequest"("timestamp");
CREATE INDEX IF NOT EXISTS "LlmRequest_provider_idx" ON "LlmRequest"("provider");
CREATE INDEX IF NOT EXISTS "LlmRequest_feature_idx" ON "LlmRequest"("feature");
CREATE INDEX IF NOT EXISTS "LlmRequest_userId_idx" ON "LlmRequest"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "LlmRequest_requestId_key" ON "LlmRequest"("requestId");

-- CreateIndex: CostSummary indexes for efficient querying
CREATE UNIQUE INDEX IF NOT EXISTS "CostSummary_provider_feature_date_key" ON "CostSummary"("provider", "feature", "date");
CREATE INDEX IF NOT EXISTS "CostSummary_provider_idx" ON "CostSummary"("provider");
CREATE INDEX IF NOT EXISTS "CostSummary_feature_idx" ON "CostSummary"("feature");
CREATE INDEX IF NOT EXISTS "CostSummary_date_idx" ON "CostSummary"("date");
