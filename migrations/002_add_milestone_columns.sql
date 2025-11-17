-- Migration: Add milestone tracking columns to videos table
-- Date: 2024-12-XX
-- Description: Adds milestone tracking columns (views24h, views48h, views7d, views30d)
--              and their capture timestamps to support question suggestion system

-- Add milestone view count columns
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS "views24h" INTEGER NULL;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS "views48h" INTEGER NULL;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS "views7d" INTEGER NULL;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS "views30d" INTEGER NULL;

-- Add milestone capture timestamp columns
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS "milestone24hCapturedAt" TIMESTAMP NULL;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS "milestone48hCapturedAt" TIMESTAMP NULL;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS "milestone7dCapturedAt" TIMESTAMP NULL;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS "milestone30dCapturedAt" TIMESTAMP NULL;

-- Add comments to document the columns
COMMENT ON COLUMN videos."views24h" IS 'Views captured 24 hours after video publication';
COMMENT ON COLUMN videos."views48h" IS 'Views captured 48 hours after video publication';
COMMENT ON COLUMN videos."views7d" IS 'Views captured 7 days after video publication';
COMMENT ON COLUMN videos."views30d" IS 'Views captured 30 days after video publication';
COMMENT ON COLUMN videos."milestone24hCapturedAt" IS 'Timestamp when 24h milestone was captured';
COMMENT ON COLUMN videos."milestone48hCapturedAt" IS 'Timestamp when 48h milestone was captured';
COMMENT ON COLUMN videos."milestone7dCapturedAt" IS 'Timestamp when 7d milestone was captured';
COMMENT ON COLUMN videos."milestone30dCapturedAt" IS 'Timestamp when 30d milestone was captured';

-- Optional: For existing videos that are already older than milestones,
-- you can backfill milestone data using current viewCount as fallback
-- This is optional and can be run separately if needed
-- 
-- UPDATE videos
-- SET 
--   "views24h" = "viewCount",
--   "milestone24hCapturedAt" = NOW()
-- WHERE "publishedAt" IS NOT NULL
--   AND EXTRACT(EPOCH FROM (NOW() - "publishedAt")) / 3600 >= 24
--   AND "milestone24hCapturedAt" IS NULL
--   AND "status" = 'public'
--   AND "visibility" = 'public';
--
-- UPDATE videos
-- SET 
--   "views48h" = "viewCount",
--   "milestone48hCapturedAt" = NOW()
-- WHERE "publishedAt" IS NOT NULL
--   AND EXTRACT(EPOCH FROM (NOW() - "publishedAt")) / 3600 >= 48
--   AND "milestone48hCapturedAt" IS NULL
--   AND "status" = 'public'
--   AND "visibility" = 'public';
--
-- UPDATE videos
-- SET 
--   "views7d" = "viewCount",
--   "milestone7dCapturedAt" = NOW()
-- WHERE "publishedAt" IS NOT NULL
--   AND EXTRACT(EPOCH FROM (NOW() - "publishedAt")) / 3600 >= 168
--   AND "milestone7dCapturedAt" IS NULL
--   AND "status" = 'public'
--   AND "visibility" = 'public';
--
-- UPDATE videos
-- SET 
--   "views30d" = "viewCount",
--   "milestone30dCapturedAt" = NOW()
-- WHERE "publishedAt" IS NOT NULL
--   AND EXTRACT(EPOCH FROM (NOW() - "publishedAt")) / 3600 >= 720
--   AND "milestone30dCapturedAt" IS NULL
--   AND "status" = 'public'
--   AND "visibility" = 'public';







