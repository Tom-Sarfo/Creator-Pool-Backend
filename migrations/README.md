# Database Migrations

This directory contains SQL migration files for database schema changes.

## Migration: Add Probability Columns

### File: `001_add_probability_columns.sql`

This migration adds the new `probabilityYes` and `probabilityNo` columns to the `pools` table.

### What it does:

1. Adds `probabilityYes` column (DECIMAL(10,4), default 0)
2. Adds `probabilityNo` column (DECIMAL(10,4), default 0)
3. Populates existing pools with initial probability values based on current stakes
4. Uses sqrt(stake) formula to calculate weights and probabilities

### Running the Migration

#### Option 1: Using psql (PostgreSQL command line)

```bash
psql -U your_username -d your_database_name -f migrations/001_add_probability_columns.sql
```

#### Option 2: Using a database client

1. Open your PostgreSQL database client (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Open the migration file
4. Execute the SQL

#### Option 3: Using Node.js script

```bash
npm run migrate
# (if you create a migrate script)
```

### Verification

After running the migration, verify it was successful:

#### Quick Verification (Command Line)

```bash
# Run the verification script
psql -U your_username -d your_database_name -f migrations/verify_migration.sql
```

#### Manual Verification Queries

Or run these queries directly in psql:

```sql
-- 1. Check if columns exist
SELECT column_name, data_type, numeric_precision, numeric_scale, column_default
FROM information_schema.columns
WHERE table_name = 'pools'
AND column_name IN ('probabilityYes', 'probabilityNo');

-- Expected: Should show 2 rows with DECIMAL(10,4) type

-- 2. Verify probabilities are populated
SELECT
  id,
  "yesStake",
  "noStake",
  "probabilityYes",
  "probabilityNo",
  ROUND("probabilityYes" + "probabilityNo", 4) as sum
FROM pools
LIMIT 10;

-- Expected: Sum should be approximately 1.0 for pools with stakes

-- 3. Count pools with probabilities
SELECT
  COUNT(*) as total_pools,
  COUNT("probabilityYes") as with_probability_yes,
  COUNT("probabilityNo") as with_probability_no
FROM pools;

-- Expected: All three counts should be equal
```

#### What to Look For

✅ **Success indicators:**

- Columns exist: `probabilityYes` and `probabilityNo` are in the pools table
- Data populated: All pools have probability values (not NULL)
- Valid ranges: All probabilities are between 0 and 1
- Sum ≈ 1.0: Probabilities sum to approximately 1.0 (within 0.01)
- For empty pools: Probabilities are 0.5 and 0.5

❌ **Failure indicators:**

- Columns don't exist: Query returns 0 rows
- NULL values: Some pools have NULL probabilities
- Invalid ranges: Probabilities outside 0-1 range
- Sum ≠ 1.0: Probabilities don't sum to ~1.0

For detailed verification, run `migrations/verify_migration.sql` which includes comprehensive checks.

### Rollback (if needed)

If you need to rollback this migration:

```sql
ALTER TABLE pools
DROP COLUMN IF EXISTS "probabilityYes";

ALTER TABLE pools
DROP COLUMN IF EXISTS "probabilityNo";
```

**Note:** This will remove the columns and you'll need to recalculate probabilities when re-running the migration.

### Development vs Production

- **Development**: If `synchronize: true` is enabled in TypeORM config, the columns will be added automatically when the server starts
- **Production**: You must run this migration manually before deploying the code changes

### Important Notes

1. The migration keeps `yesOdds` and `noOdds` columns for backwards compatibility
2. Probabilities are calculated based on existing pool stakes
3. For pools with no stakes, probabilities default to 0.5 (50/50)
4. The backend will recalculate probabilities automatically when predictions are added/removed
