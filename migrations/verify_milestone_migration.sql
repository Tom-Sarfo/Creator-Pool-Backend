-- Verification Queries for Milestone Columns Migration
-- Run this after executing 002_add_milestone_columns.sql

-- 1. Check if all milestone columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'videos'
  AND column_name IN (
    'views24h',
    'views48h',
    'views7d',
    'views30d',
    'milestone24hCapturedAt',
    'milestone48hCapturedAt',
    'milestone7dCapturedAt',
    'milestone30dCapturedAt'
  )
ORDER BY column_name;

-- Expected: Should show 8 rows with the following:
-- - views24h, views48h, views7d, views30d: INTEGER, nullable
-- - milestone24hCapturedAt, milestone48hCapturedAt, milestone7dCapturedAt, milestone30dCapturedAt: TIMESTAMP, nullable

-- 2. Check column counts
SELECT 
  COUNT(*) as total_milestone_columns
FROM information_schema.columns
WHERE table_name = 'videos'
  AND column_name LIKE 'views%'
  AND column_name IN ('views24h', 'views48h', 'views7d', 'views30d');

-- Expected: Should return 4

SELECT 
  COUNT(*) as total_milestone_timestamp_columns
FROM information_schema.columns
WHERE table_name = 'videos'
  AND column_name LIKE 'milestone%CapturedAt';

-- Expected: Should return 4

-- 3. Verify columns are nullable (should be NULL for new videos)
SELECT 
  COUNT(*) as nullable_columns
FROM information_schema.columns
WHERE table_name = 'videos'
  AND column_name IN (
    'views24h',
    'views48h',
    'views7d',
    'views30d',
    'milestone24hCapturedAt',
    'milestone48hCapturedAt',
    'milestone7dCapturedAt',
    'milestone30dCapturedAt'
  )
  AND is_nullable = 'YES';

-- Expected: Should return 8 (all columns should be nullable)

-- 4. Check for any existing milestone data (if backfill was run)
SELECT 
  COUNT(*) as total_videos,
  COUNT("views24h") as videos_with_24h,
  COUNT("views48h") as videos_with_48h,
  COUNT("views7d") as videos_with_7d,
  COUNT("views30d") as videos_with_30d,
  COUNT("milestone24hCapturedAt") as milestone_24h_captured,
  COUNT("milestone48hCapturedAt") as milestone_48h_captured,
  COUNT("milestone7dCapturedAt") as milestone_7d_captured,
  COUNT("milestone30dCapturedAt") as milestone_30d_captured
FROM videos;

-- Expected: Shows distribution of milestone data across videos

-- 5. Check videos eligible for milestone tracking (public videos with publishedAt)
SELECT 
  COUNT(*) as eligible_videos,
  COUNT(CASE WHEN "publishedAt" IS NOT NULL THEN 1 END) as with_published_at,
  COUNT(CASE WHEN "status" = 'public' AND "visibility" = 'public' THEN 1 END) as public_videos
FROM videos
WHERE "status" = 'public'
  AND "visibility" = 'public';

-- Expected: Shows how many videos are eligible for milestone tracking

-- 6. Check videos that should have milestones captured (older than 24h)
SELECT 
  COUNT(*) as videos_older_than_24h,
  COUNT(CASE WHEN "milestone24hCapturedAt" IS NOT NULL THEN 1 END) as with_24h_milestone,
  COUNT(CASE WHEN "milestone24hCapturedAt" IS NULL 
             AND EXTRACT(EPOCH FROM (NOW() - "publishedAt")) / 3600 >= 24 
             AND "status" = 'public' 
             AND "visibility" = 'public' 
        THEN 1 END) as missing_24h_milestone
FROM videos
WHERE "publishedAt" IS NOT NULL
  AND EXTRACT(EPOCH FROM (NOW() - "publishedAt")) / 3600 >= 24
  AND "status" = 'public'
  AND "visibility" = 'public';

-- Expected: Shows videos that should have 24h milestone but don't yet
-- Note: These will be captured automatically by the metrics tracking service

-- 7. Sample of videos with milestone data
SELECT 
  id,
  "youtubeId",
  title,
  "publishedAt",
  "viewCount",
  "views24h",
  "views48h",
  "views7d",
  "views30d",
  "milestone24hCapturedAt",
  "milestone48hCapturedAt",
  "milestone7dCapturedAt",
  "milestone30dCapturedAt",
  EXTRACT(EPOCH FROM (NOW() - "publishedAt")) / 3600 as hours_since_publication
FROM videos
WHERE "publishedAt" IS NOT NULL
  AND "status" = 'public'
  AND "visibility" = 'public'
ORDER BY "publishedAt" DESC
LIMIT 10;

-- Expected: Shows sample of videos with their milestone data (if any)

-- 8. Verify milestone data integrity (if any exists)
SELECT 
  COUNT(*) as videos_with_invalid_milestones
FROM videos
WHERE (
  ("milestone24hCapturedAt" IS NOT NULL AND "views24h" IS NULL)
  OR ("milestone48hCapturedAt" IS NOT NULL AND "views48h" IS NULL)
  OR ("milestone7dCapturedAt" IS NOT NULL AND "views7d" IS NULL)
  OR ("milestone30dCapturedAt" IS NOT NULL AND "views30d" IS NULL)
);

-- Expected: Should return 0 (no videos with timestamps but no view counts)

-- 9. Summary report
SELECT 
  'Migration Verification Summary' as report,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'videos' 
   AND column_name IN ('views24h', 'views48h', 'views7d', 'views30d')) as view_columns_added,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'videos' 
   AND column_name LIKE 'milestone%CapturedAt') as timestamp_columns_added,
  (SELECT COUNT(*) FROM videos 
   WHERE "milestone24hCapturedAt" IS NOT NULL) as videos_with_24h_data,
  (SELECT COUNT(*) FROM videos 
   WHERE "milestone7dCapturedAt" IS NOT NULL) as videos_with_7d_data,
  (SELECT COUNT(*) FROM videos 
   WHERE "status" = 'public' 
   AND "visibility" = 'public' 
   AND "publishedAt" IS NOT NULL) as eligible_videos;

-- Expected: Summary showing all columns were added and status of milestone data










