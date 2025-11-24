# Migration Status: Odds to Weighted Probability System

## ✅ Completed Tasks

### Backend Implementation (100% Complete)

1. ✅ **ProbabilityService Created**

   - Location: `src/pools/services/probability.service.ts`
   - Implements weighted probability using `sqrt(stake)` formula
   - Calculates potential payouts with proper capping
   - Replaces old `OddsService` functionality

2. ✅ **Pool Entity Updated**

   - Added `probabilityYes` and `probabilityNo` columns (DECIMAL(10,4))
   - Kept deprecated `yesOdds` and `noOdds` for backwards compatibility
   - Location: `src/entities/pool.entity.ts`

3. ✅ **PoolService Updated**

   - Replaced all `OddsService` references with `ProbabilityService`
   - All pool endpoints now return probabilities
   - `getPools()`, `getPoolById()`, `getPoolStats()` updated
   - Location: `src/pools/pool.service.ts`

4. ✅ **PredictionService Updated**

   - Replaced `OddsService` with `ProbabilityService`
   - `createPrediction()` now returns probabilities and potential payout
   - All probability calculations updated
   - Location: `src/predictions/prediction.service.ts`

5. ✅ **MetricsTrackingService Updated**

   - Removed odds update logic
   - Probabilities now calculated based on weighted stakes only
   - Location: `src/videos/services/metrics-tracking.service.ts`

6. ✅ **PoolModule Updated**

   - Replaced `OddsService` with `ProbabilityService` in providers/exports
   - Location: `src/pools/pool.module.ts`

7. ✅ **Old OddsService Removed**

   - Deleted: `src/pools/services/odds.service.ts`

8. ✅ **Frontend Integration Guide Created**

   - Comprehensive migration guide
   - API response format documentation
   - Code examples for frontend migration
   - Location: `weighted-count.md`

9. ✅ **Database Migration SQL Created**
   - SQL migration file ready
   - Includes initial probability calculation for existing pools
   - Location: `migrations/001_add_probability_columns.sql`

## ⚠️ Action Required

### Database Migration

**Status**: Migration SQL file created, but **NOT YET RUN** on database

**What to do:**

1. Review the migration file: `migrations/001_add_probability_columns.sql`
2. Run the migration on your database
3. Verify columns were added correctly

**How to run:**

```bash
# Using psql
psql -U your_username -d your_database_name -f migrations/001_add_probability_columns.sql

# Or using your preferred database client
```

**Details:** See `migrations/README.md` for complete instructions.

### Development Environment Note

If `synchronize: true` is enabled in TypeORM config (development only), the columns will be automatically added when the server starts. However, you should still run the migration for:

- Existing pools (to populate initial probability values)
- Production environments (where synchronize should be false)

## 📊 Current API Response Format

### GET /pools

Returns pools with:

```typescript
{
  pools: Pool[],
  // Pool includes:
  probabilityYes: number,  // 0-1 range
  probabilityNo: number,   // 0-1 range
  // ... other fields
}
```

### GET /pools/:id

Returns pool with calculated probabilities:

```typescript
{
  probabilityYes: number,
  probabilityNo: number,
  // ... other fields
}
```

### GET /pools/:id/stats

Returns stats including probabilities:

```typescript
{
  probabilityYes: number,
  probabilityNo: number,
  // ... other stats
}
```

### POST /predictions

Returns:

```typescript
{
  prediction: Prediction,
  potentialPayout: number,
  updatedProbabilities: {
    probabilityYes: number,
    probabilityNo: number,
  }
}
```

## 🧪 Testing Checklist

After running the database migration:

- [ ] Verify columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'pools' AND column_name IN ('probabilityYes', 'probabilityNo');`
- [ ] Test GET /pools endpoint - should return probability fields
- [ ] Test GET /pools/:id endpoint - should return probability fields
- [ ] Test GET /pools/:id/stats endpoint - should return probability fields
- [ ] Test POST /predictions - should return potentialPayout and updatedProbabilities
- [ ] Verify probabilities sum to approximately 1.0
- [ ] Verify probabilities update when new predictions are added
- [ ] Verify potential payouts are calculated correctly

## 📝 Next Steps

1. **Run Database Migration** (see `migrations/README.md`)
2. **Test API Endpoints** to verify probabilities are returned
3. **Frontend Migration** can begin (see `weighted-count.md`)

## 🔗 Related Documentation

- **Frontend Migration Guide**: `weighted-count.md`
- **Migration Instructions**: `migrations/README.md`
- **Migration SQL**: `migrations/001_add_probability_columns.sql`
- **Original Requirements**: `Probability.md`








