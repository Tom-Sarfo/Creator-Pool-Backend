-- Verification script for escrow and transactions migration
-- Run this after executing 003_add_escrow_and_transactions.sql

-- 1. Check if escrow columns exist in pools table
SELECT 
  column_name, 
  data_type, 
  numeric_precision, 
  numeric_scale, 
  column_default
FROM information_schema.columns
WHERE table_name = 'pools'
  AND column_name IN (
    'escrowedAmount',
    'escrowedCreatorPledge',
    'escrowedPredictorStakes',
    'platformFeeCollected',
    'creatorRoyaltyCollected'
  )
ORDER BY column_name;

-- Expected: Should show 5 rows

-- 2. Check if transactions table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'transactions';

-- Expected: Should show 1 row

-- 3. Check transactions table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- Expected: Should show all transaction columns

-- 4. Check if transaction type enum exists
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'transactions_type_enum'
ORDER BY e.enumsortorder;

-- Expected: Should show 8 enum values

-- 5. Check if transaction status enum exists
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'transactions_status_enum'
ORDER BY e.enumsortorder;

-- Expected: Should show 3 enum values

-- 6. Check indexes on transactions table
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'transactions'
ORDER BY indexname;

-- Expected: Should show indexes for userId, poolId, type, status, createdAt

-- 7. Verify foreign key constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'transactions'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Expected: Should show foreign keys to users and pools tables

-- Summary
SELECT 
  'Migration Verification Complete' as status,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'pools' AND column_name LIKE 'escrow%') as escrow_columns_count,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'transactions') as transactions_table_exists,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'transactions') as transaction_indexes_count;


