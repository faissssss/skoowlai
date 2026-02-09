-- Add per-feature usage dates to avoid cross-feature daily limit interference
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastFlashcardUsageDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastQuizUsageDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastMindmapUsageDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastStudyDeckUsageDate" TIMESTAMP(3);
