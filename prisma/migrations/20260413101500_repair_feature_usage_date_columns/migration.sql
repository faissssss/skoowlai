-- Repair migration for environments where 20260209000000 was recorded as applied
-- before the per-feature usage date columns actually existed.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastFlashcardUsageDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastQuizUsageDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastMindmapUsageDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastStudyDeckUsageDate" TIMESTAMP(3);
