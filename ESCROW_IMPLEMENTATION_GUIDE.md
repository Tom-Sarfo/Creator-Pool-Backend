# Escrow System Implementation Guide

## ✅ Implementation Complete

The escrow system has been fully implemented. Follow these steps to activate it.

## Step 1: Run Database Migration

### Option A: Using psql (Command Line)

```bash
# If you have DATABASE_URL in your .env file
psql $DATABASE_URL -f migrations/003_add_escrow_and_transactions.sql

# Or if using individual connection parameters
psql -U your_username -d your_database_name -f migrations/003_add_escrow_and_transactions.sql
```

### Option B: Using Database Client

1. Open your PostgreSQL client (pgAdmin, DBeaver, TablePlus, etc.)
2. Connect to your database
3. Open the file: `migrations/003_add_escrow_and_transactions.sql`
4. Execute the SQL script

### Option C: Using TypeORM (if configured)

```bash
npm run migration:run
```

**Note:** The migration file is SQL-based, so Option A or B is recommended.

## Step 2: Verify Migration

Run the verification script:

```bash
psql $DATABASE_URL -f migrations/verify_escrow_migration.sql
```

Or manually check:

```sql
-- Check escrow columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'pools' 
AND column_name LIKE 'escrow%';

-- Check transactions table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'transactions';
```

## Step 3: Rebuild and Restart Server

```bash
# Build the TypeScript code
npm run build

# Restart your development server
npm run start:dev

# Or for production
npm run start:prod
```

## Step 4: Test the Implementation

### Test 1: Create Pool with Pledge

```bash
POST /api/pools
Authorization: Bearer <token>
{
  "videoId": "uuid",
  "question": "Will this video reach 10k views?",
  "targetViews": 10000,
  "creatorPledge": 50.00
}
```

**Expected Behavior:**
- Creator's wallet balance decreases by $50
- Pool's `escrowedCreatorPledge` increases by $50
- Pool's `escrowedAmount` increases by $50
- Transaction record created with type `PLEDGE`

### Test 2: Create Prediction

```bash
POST /api/predictions
Authorization: Bearer <token>
{
  "poolId": "pool-uuid",
  "choice": "yes",
  "stake": 25.00
}
```

**Expected Behavior:**
- Predictor's wallet balance decreases by $25
- Pool's `escrowedPredictorStakes` increases by $25
- Pool's `escrowedAmount` increases by $25
- Transaction record created with type `STAKE`

### Test 3: Settle Pool

```bash
POST /api/pools/:id/settle
Authorization: Bearer <token>
```

**Expected Behavior:**
- Winners receive payouts (proportional share of losing side + creator pledge)
- Creator receives 1% royalty from losing side
- Platform fee (5%) is tracked in `platformFeeCollected`
- All escrow funds are distributed
- Transaction records created for:
  - `WINNINGS` for each winner
  - `ROYALTY` for creator
  - `PLATFORM_FEE` (tracked)

### Test 4: Check Transaction History

```bash
GET /api/transactions?userId=user-uuid
Authorization: Bearer <token>
```

**Note:** You may need to create this endpoint if it doesn't exist yet (see Step 5).

## Step 5: Optional - Add Transaction API Endpoints

If you want to expose transaction history via API, add these endpoints:

### In `src/pools/pool.controller.ts` or create `src/pools/transaction.controller.ts`:

```typescript
@Get('transactions')
@UseGuards(JwtAuthGuard)
async getUserTransactions(
  @Request() req,
  @Query() filters: TransactionFilters
) {
  return this.transactionService.getUserTransactions(
    req.user.id,
    filters
  );
}

@Get('pools/:id/transactions')
@UseGuards(JwtAuthGuard)
async getPoolTransactions(@Param('id') id: string) {
  return this.transactionService.getPoolTransactions(id);
}
```

## What Changed

### New Features

1. **Escrow System**
   - All stakes and pledges are held in escrow until settlement
   - Funds are tracked per pool
   - Atomic operations ensure data integrity

2. **Transaction Tracking**
   - Every financial movement is recorded
   - Full audit trail of all transactions
   - Supports filtering and pagination

3. **Settlement Distribution**
   - Winners get proportional share of (losing side - fees + creator pledge)
   - Creator gets 1% royalty from losing side
   - Platform fee (5%) is tracked
   - All distributions happen atomically

### Modified Files

- `src/entities/pool.entity.ts` - Added escrow fields
- `src/entities/user.entity.ts` - Added transaction relation
- `src/entities/transaction.entity.ts` - **NEW** Transaction entity
- `src/pools/services/escrow.service.ts` - **NEW** Escrow management
- `src/pools/services/transaction.service.ts` - **NEW** Transaction management
- `src/pools/pool.service.ts` - Updated to use escrow
- `src/predictions/prediction.service.ts` - Updated to use escrow
- `src/pools/services/pool-lifecycle.service.ts` - Updated settlement logic
- `src/pools/pool.module.ts` - Registered new services
- `src/app.module.ts` - Registered Transaction entity

### Database Changes

- Added 5 escrow columns to `pools` table
- Created `transactions` table with indexes
- Created transaction type and status enums

## Troubleshooting

### Migration Fails

If the migration fails, check:
1. Database connection is working
2. You have sufficient permissions
3. No conflicting schema changes

### Escrow Balance Mismatch

If escrow amounts don't match:
- Run `escrowService.validateEscrowIntegrity(poolId)` to check
- Review transaction logs
- Check for failed transactions

### Settlement Fails

If settlement fails:
- Check pool has predictions
- Verify escrow has sufficient funds
- Check transaction logs for errors
- Ensure pool is in CLOSED status

## Next Steps

1. ✅ Run migration
2. ✅ Verify migration
3. ✅ Test pool creation with pledge
4. ✅ Test prediction creation
5. ✅ Test settlement
6. ⬜ Add transaction API endpoints (optional)
7. ⬜ Update frontend to show escrow status
8. ⬜ Add escrow balance display in pool details

## Support

If you encounter any issues:
1. Check server logs for errors
2. Verify database schema matches migration
3. Review transaction records for discrepancies
4. Test with small amounts first


