-- Verification Queries for Probability Columns Migration
-- Run these queries after executing 001_add_probability_columns.sql to verify success

-- 1. Check if columns exist
SELECT 
    column_name, 
    data_type, 
    numeric_precision,
    numeric_scale,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'pools'
AND column_name IN ('probabilityYes', 'probabilityNo')
ORDER BY column_name;

-- Expected result: Should show 2 rows with:
-- - probabilityYes: DECIMAL(10,4), default 0, NOT NULL
-- - probabilityNo: DECIMAL(10,4), default 0, NOT NULL

-- 2. Check column comments (if PostgreSQL supports them)
SELECT 
    col.column_name,
    obj_description(col.oid, 'pg_class') as table_comment,
    col_description(col.oid, col.ordinal_position) as column_comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN information_schema.columns col ON col.table_name = c.relname
WHERE c.relname = 'pools'
AND col.column_name IN ('probabilityYes', 'probabilityNo');

-- 3. Verify probabilities are populated for existing pools
SELECT 
    id,
    question,
    "yesStake",
    "noStake",
    "totalStake",
    "probabilityYes",
    "probabilityNo",
    ROUND("probabilityYes" + "probabilityNo", 4) as sum_of_probabilities,
    CASE 
        WHEN ABS(("probabilityYes" + "probabilityNo") - 1.0) < 0.01 
        THEN '✓ Valid' 
        ELSE '✗ Invalid (should sum to ~1.0)' 
    END as validation_status
FROM pools
ORDER BY "totalStake" DESC
LIMIT 10;

-- Expected result: 
-- - All pools should have probabilityYes and probabilityNo values
-- - Sum should be approximately 1.0 (within 0.01 tolerance)
-- - For pools with no stakes, both should be 0.5

-- 4. Verify probabilities are calculated correctly using sqrt formula
-- This compares calculated values with stored values
SELECT 
    id,
    "yesStake",
    "noStake",
    "probabilityYes" as stored_probability_yes,
    "probabilityNo" as stored_probability_no,
    -- Calculate expected probability
    CASE 
        WHEN "yesStake" = 0 AND "noStake" = 0 THEN 0.5
        WHEN SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC)) = 0 
        THEN 0.5
        ELSE 
            ROUND(
                SQRT(CAST("yesStake" AS NUMERIC)) / 
                (SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC))),
                4
            )
    END as calculated_probability_yes,
    CASE 
        WHEN "yesStake" = 0 AND "noStake" = 0 THEN 0.5
        WHEN SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC)) = 0 
        THEN 0.5
        ELSE 
            ROUND(
                SQRT(CAST("noStake" AS NUMERIC)) / 
                (SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC))),
                4
            )
    END as calculated_probability_no,
    -- Check if stored matches calculated (within tolerance)
    CASE 
        WHEN ABS("probabilityYes" - 
            CASE 
                WHEN "yesStake" = 0 AND "noStake" = 0 THEN 0.5
                WHEN SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC)) = 0 
                THEN 0.5
                ELSE SQRT(CAST("yesStake" AS NUMERIC)) / 
                     (SQRT(CAST("yesStake" AS NUMERIC)) + SQRT(CAST("noStake" AS NUMERIC)))
            END) < 0.0001
        THEN '✓ Match'
        ELSE '✗ Mismatch'
    END as validation
FROM pools
WHERE "totalStake" > 0
LIMIT 10;

-- 5. Count pools and check for any NULL values (should be none)
SELECT 
    COUNT(*) as total_pools,
    COUNT("probabilityYes") as pools_with_probability_yes,
    COUNT("probabilityNo") as pools_with_probability_no,
    COUNT(*) - COUNT("probabilityYes") as missing_probability_yes,
    COUNT(*) - COUNT("probabilityNo") as missing_probability_no
FROM pools;

-- Expected result:
-- - pools_with_probability_yes should equal total_pools
-- - pools_with_probability_no should equal total_pools
-- - missing_probability_yes and missing_probability_no should be 0

-- 6. Check probability ranges (should be between 0 and 1)
SELECT 
    COUNT(*) as total_pools,
    COUNT(CASE WHEN "probabilityYes" >= 0 AND "probabilityYes" <= 1 THEN 1 END) as valid_probability_yes_range,
    COUNT(CASE WHEN "probabilityNo" >= 0 AND "probabilityNo" <= 1 THEN 1 END) as valid_probability_no_range,
    COUNT(CASE WHEN "probabilityYes" < 0 OR "probabilityYes" > 1 THEN 1 END) as invalid_probability_yes,
    COUNT(CASE WHEN "probabilityNo" < 0 OR "probabilityNo" > 1 THEN 1 END) as invalid_probability_no
FROM pools;

-- Expected result:
-- - valid_probability_yes_range should equal total_pools
-- - valid_probability_no_range should equal total_pools
-- - invalid_probability_yes and invalid_probability_no should be 0

-- 7. Summary report
SELECT 
    'Migration Verification Summary' as report_section,
    COUNT(*) as total_pools,
    COUNT(CASE WHEN "probabilityYes" IS NOT NULL AND "probabilityNo" IS NOT NULL THEN 1 END) as pools_with_probabilities,
    COUNT(CASE WHEN ABS(("probabilityYes" + "probabilityNo") - 1.0) < 0.01 THEN 1 END) as pools_with_valid_sum,
    COUNT(CASE WHEN "probabilityYes" >= 0 AND "probabilityYes" <= 1 
               AND "probabilityNo" >= 0 AND "probabilityNo" <= 1 THEN 1 END) as pools_with_valid_ranges,
    CASE 
        WHEN COUNT(*) = COUNT(CASE WHEN "probabilityYes" IS NOT NULL AND "probabilityNo" IS NOT NULL THEN 1 END)
         AND COUNT(CASE WHEN ABS(("probabilityYes" + "probabilityNo") - 1.0) < 0.01 THEN 1 END) = COUNT(*)
         AND COUNT(CASE WHEN "probabilityYes" >= 0 AND "probabilityYes" <= 1 
                        AND "probabilityNo" >= 0 AND "probabilityNo" <= 1 THEN 1 END) = COUNT(*)
        THEN '✓ MIGRATION SUCCESSFUL'
        ELSE '✗ MIGRATION ISSUES DETECTED'
    END as migration_status
FROM pools;





