-- Migration: Add probabilityYes and probabilityNo columns to pools table
-- Date: 2024-12-XX
-- Description: Adds new probability columns to support weighted-count probability model
--              while keeping deprecated yesOdds and noOdds columns for backwards compatibility

-- Add probabilityYes column
ALTER TABLE pools
ADD COLUMN IF NOT EXISTS "probabilityYes" DECIMAL(10,4) NOT NULL DEFAULT 0;

-- Add probabilityNo column
ALTER TABLE pools
ADD COLUMN IF NOT EXISTS "probabilityNo" DECIMAL(10,4) NOT NULL DEFAULT 0;

-- Update existing pools with initial probability values based on current stakes
-- Calculate probabilities using sqrt(stake) weights
UPDATE pools
SET 
  "probabilityYes" = CASE 
    WHEN "totalStake" = 0 THEN 0.5
    WHEN ("yesStake" = 0 AND "noStake" = 0) THEN 0.5
    ELSE 
      CASE 
        WHEN SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC)) = 0 
        THEN 0.5
        ELSE 
          SQRT(CAST("yesStake" AS NUMERIC)) / 
          (SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC)))
      END
  END,
  "probabilityNo" = CASE 
    WHEN "totalStake" = 0 THEN 0.5
    WHEN ("yesStake" = 0 AND "noStake" = 0) THEN 0.5
    ELSE 
      CASE 
        WHEN SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC)) = 0 
        THEN 0.5
        ELSE 
          SQRT(CAST("noStake" AS NUMERIC)) / 
          (SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC)))
      END
  END
WHERE "probabilityYes" = 0 OR "probabilityNo" = 0;

-- Add comment to document the columns
COMMENT ON COLUMN pools."probabilityYes" IS 'Probability of YES outcome (0-1 range), calculated using sqrt(stake) weights';
COMMENT ON COLUMN pools."probabilityNo" IS 'Probability of NO outcome (0-1 range), calculated using sqrt(stake) weights';

-- Verify: Check that probabilities sum to approximately 1.0 (may be slightly off due to rounding)
-- SELECT id, "probabilityYes", "probabilityNo", ("probabilityYes" + "probabilityNo") as sum
-- FROM pools
-- WHERE "totalStake" > 0;






