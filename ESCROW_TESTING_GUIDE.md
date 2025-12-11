# Escrow System Testing Guide

## Prerequisites

1. Server is running: `npm run start:dev`
2. You have authentication tokens for:
   - A creator user (to create pools)
   - A predictor user (to make predictions)
3. Users have wallet balances (use `/api/auth/add-funds` if needed)

---

## Test 1: Create Pool with Pledge (Escrow Deposit)

### Step 1: Check Creator's Initial Wallet Balance

```bash
# Get creator's profile (includes wallet balance)
GET /api/auth/profile
Authorization: Bearer <creator_token>
```

**Expected:** Note the current `walletBalance` (e.g., $100.00)

### Step 2: Create Pool with Pledge

```bash
POST /api/pools
Authorization: Bearer <creator_token>
Content-Type: application/json

{
  "videoId": "<valid-video-uuid>",
  "question": "Will this video reach 10k views?",
  "targetViews": 10000,
  "creatorPledge": 50.00,
  "predictionWindowMinutes": 15,
  "trackingDurationDays": 7
}
```

### Step 3: Verify Results

**Check Creator's Wallet:**
```bash
GET /api/auth/profile
Authorization: Bearer <creator_token>
```

**Expected:**
- ✅ `walletBalance` decreased by $50.00
- ✅ New balance = old balance - $50.00

**Check Pool Escrow (via database or API):**
```bash
GET /api/pools/<pool-id>
Authorization: Bearer <creator_token>
```

**Expected:**
- ✅ `creatorPledge` = 50.00
- ✅ `escrowedCreatorPledge` = 50.00
- ✅ `escrowedAmount` = 50.00
- ✅ `escrowedPredictorStakes` = 0.00

**Check Transaction Record (via database):**
```sql
SELECT * FROM transactions 
WHERE "poolId" = '<pool-id>' 
AND type = 'pledge'
ORDER BY "createdAt" DESC 
LIMIT 1;
```

**Expected:**
- ✅ Transaction exists
- ✅ `type` = 'pledge'
- ✅ `amount` = 50.00
- ✅ `status` = 'completed'
- ✅ `userId` = creator's ID

---

## Test 2: Make Prediction (Stake Escrow Deposit)

### Step 1: Check Predictor's Initial Wallet Balance

```bash
GET /api/auth/profile
Authorization: Bearer <predictor_token>
```

**Expected:** Note the current `walletBalance` (e.g., $75.00)

### Step 2: Create Prediction

```bash
POST /api/predictions
Authorization: Bearer <predictor_token>
Content-Type: application/json

{
  "poolId": "<pool-id-from-test-1>",
  "choice": "yes",
  "stake": 25.00
}
```

### Step 3: Verify Results

**Check Predictor's Wallet:**
```bash
GET /api/auth/profile
Authorization: Bearer <predictor_token>
```

**Expected:**
- ✅ `walletBalance` decreased by $25.00
- ✅ New balance = old balance - $25.00

**Check Pool Escrow:**
```bash
GET /api/pools/<pool-id>
```

**Expected:**
- ✅ `totalStake` = 25.00
- ✅ `yesStake` = 25.00
- ✅ `escrowedPredictorStakes` = 25.00
- ✅ `escrowedAmount` = 75.00 (50 pledge + 25 stake)
- ✅ `escrowedCreatorPledge` = 50.00 (unchanged)

**Check Transaction Record:**
```sql
SELECT * FROM transactions 
WHERE "poolId" = '<pool-id>' 
AND type = 'stake'
ORDER BY "createdAt" DESC 
LIMIT 1;
```

**Expected:**
- ✅ Transaction exists
- ✅ `type` = 'stake'
- ✅ `amount` = 25.00
- ✅ `status` = 'completed'
- ✅ `userId` = predictor's ID

---

## Test 3: Multiple Predictions (Verify Escrow Accumulation)

### Step 1: Make Another Prediction

```bash
POST /api/predictions
Authorization: Bearer <another_predictor_token>

{
  "poolId": "<pool-id>",
  "choice": "no",
  "stake": 30.00
}
```

### Step 2: Verify Escrow Updated

**Check Pool:**
```bash
GET /api/pools/<pool-id>
```

**Expected:**
- ✅ `totalStake` = 55.00 (25 + 30)
- ✅ `yesStake` = 25.00
- ✅ `noStake` = 30.00
- ✅ `escrowedPredictorStakes` = 55.00
- ✅ `escrowedAmount` = 105.00 (50 pledge + 55 stakes)

---

## Test 4: Deposit Additional Pledge

### Step 1: Deposit More Pledge

```bash
POST /api/pools/<pool-id>/deposit-pledge
Authorization: Bearer <creator_token>
Content-Type: application/json

{
  "amount": 25.00
}
```

### Step 2: Verify Results

**Check Creator's Wallet:**
- ✅ Decreased by additional $25.00

**Check Pool Escrow:**
- ✅ `creatorPledge` = 75.00 (50 + 25)
- ✅ `escrowedCreatorPledge` = 75.00
- ✅ `escrowedAmount` = 130.00 (75 pledge + 55 stakes)

**Check Transaction:**
- ✅ New transaction with type 'pledge' and amount 25.00

---

## Test 5: Settle Pool (Escrow Distribution)

### Prerequisites
- Pool must be in `CLOSED` status
- Pool must have predictions on both sides (yes and no)
- Pool must have a creator pledge

### Step 1: Close Pool Tracking Period

If pool is still in `LIVE_TRACKING`, wait for tracking period to end or manually close:

```bash
POST /api/pools/<pool-id>/close-tracking
Authorization: Bearer <creator_token>
```

### Step 2: Settle Pool

```bash
POST /api/pools/<pool-id>/settle
Authorization: Bearer <creator_token>
```

### Step 3: Verify Settlement Results

**Check Pool Status:**
```bash
GET /api/pools/<pool-id>
```

**Expected:**
- ✅ `status` = 'settled'
- ✅ `result` = 'yes_won' or 'no_won' (based on views)
- ✅ `settledAt` is set
- ✅ `platformFeeCollected` = 5% of losing side stake
- ✅ `creatorRoyaltyCollected` = 1% of losing side stake
- ✅ `escrowedAmount` = 0 (or very close to 0, accounting for rounding)

**Check Predictions:**
```bash
GET /api/predictions?poolId=<pool-id>
```

**Expected:**
- ✅ Winning predictions have `result` = 'won'
- ✅ Losing predictions have `result` = 'lost'
- ✅ Winning predictions have `actualPayout` > 0
- ✅ Losing predictions have `actualPayout` = 0

**Check Winner's Wallet:**
```bash
GET /api/auth/profile
Authorization: Bearer <winner_token>
```

**Expected:**
- ✅ Wallet increased by payout amount
- ✅ Payout = proportional share of (losing side - fees + creator pledge)

**Check Creator's Wallet:**
```bash
GET /api/auth/profile
Authorization: Bearer <creator_token>
```

**Expected:**
- ✅ Wallet increased by royalty amount (1% of losing side)
- ✅ Creator did NOT get their pledge back (it went to winners)

**Check Transactions:**
```sql
SELECT type, amount, "userId", status 
FROM transactions 
WHERE "poolId" = '<pool-id>'
ORDER BY "createdAt";
```

**Expected:**
- ✅ Multiple 'winnings' transactions for each winner
- ✅ One 'royalty' transaction for creator
- ✅ One 'platform_fee' transaction (tracked)
- ✅ All transactions have status = 'completed'

---

## Test 6: Escrow Integrity Check

### Verify Escrow Matches Pool Stakes

```sql
SELECT 
  p.id,
  p."escrowedAmount",
  p."escrowedCreatorPledge",
  p."escrowedPredictorStakes",
  (p."escrowedCreatorPledge" + p."escrowedPredictorStakes") as calculated_escrow,
  (p."escrowedAmount" - (p."escrowedCreatorPledge" + p."escrowedPredictorStakes")) as difference
FROM pools p
WHERE p.id = '<pool-id>';
```

**Expected:**
- ✅ `difference` should be 0 (or very close, accounting for rounding)
- ✅ `escrowedAmount` = `escrowedCreatorPledge` + `escrowedPredictorStakes`

---

## Test 7: Edge Cases

### Test 7a: Insufficient Balance

```bash
POST /api/pools
Authorization: Bearer <creator_token>

{
  "videoId": "<video-id>",
  "question": "Test",
  "targetViews": 1000,
  "creatorPledge": 999999.00  # More than wallet balance
}
```

**Expected:**
- ✅ Error: "Insufficient wallet balance for pledge"
- ✅ No pool created
- ✅ Wallet balance unchanged

### Test 7b: Prediction with Insufficient Balance

```bash
POST /api/predictions
Authorization: Bearer <predictor_token>

{
  "poolId": "<pool-id>",
  "choice": "yes",
  "stake": 999999.00  # More than wallet balance
}
```

**Expected:**
- ✅ Error: "Insufficient wallet balance"
- ✅ No prediction created
- ✅ Wallet balance unchanged

### Test 7c: Settle Pool with No Winners

Create a pool where all predictions are on the losing side, then settle.

**Expected:**
- ✅ Pool settles correctly
- ✅ No winnings transactions (all lost)
- ✅ Creator still gets royalty
- ✅ Platform fee still collected

### Test 7d: Settle Pool with No Predictions

Create a pool with only creator pledge, no predictions, then settle.

**Expected:**
- ✅ Pool settles
- ✅ Creator pledge stays in escrow (or gets refunded based on business logic)
- ✅ No winnings to distribute

---

## Test 8: Transaction History

### Get User Transactions

```bash
# If you've added the endpoint
GET /api/transactions?userId=<user-id>
Authorization: Bearer <token>
```

**Or check database:**
```sql
SELECT 
  type,
  amount,
  status,
  description,
  "createdAt"
FROM transactions
WHERE "userId" = '<user-id>'
ORDER BY "createdAt" DESC;
```

**Expected:**
- ✅ All transactions visible
- ✅ Correct types (pledge, stake, winnings, royalty)
- ✅ Correct amounts
- ✅ All have status = 'completed'

---

## Verification Checklist

After running all tests, verify:

- [ ] Creator pledge moves to escrow on pool creation
- [ ] Predictor stakes move to escrow on prediction
- [ ] Wallet balances decrease correctly
- [ ] Escrow amounts match pool stakes
- [ ] Settlement distributes funds correctly
- [ ] Winners receive proportional payouts
- [ ] Creator receives royalty (1%)
- [ ] Platform fee is tracked (5%)
- [ ] All transactions are recorded
- [ ] Escrow is cleared after settlement
- [ ] Insufficient balance errors work correctly

---

## Quick Test Script

Save this as `test-escrow.sh`:

```bash
#!/bin/bash

# Set your tokens
CREATOR_TOKEN="your-creator-token"
PREDICTOR_TOKEN="your-predictor-token"
API_URL="http://localhost:3000/api"

echo "🧪 Testing Escrow System"
echo ""

# Test 1: Create pool
echo "1. Creating pool with pledge..."
POOL_RESPONSE=$(curl -s -X POST "$API_URL/pools" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "your-video-id",
    "question": "Test pool",
    "targetViews": 1000,
    "creatorPledge": 50.00
  }')

POOL_ID=$(echo $POOL_RESPONSE | jq -r '.id')
echo "✅ Pool created: $POOL_ID"
echo ""

# Test 2: Make prediction
echo "2. Making prediction..."
curl -s -X POST "$API_URL/predictions" \
  -H "Authorization: Bearer $PREDICTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"poolId\": \"$POOL_ID\",
    \"choice\": \"yes\",
    \"stake\": 25.00
  }"
echo "✅ Prediction created"
echo ""

# Test 3: Check escrow
echo "3. Checking escrow..."
curl -s -X GET "$API_URL/pools/$POOL_ID" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq '{
    escrowedAmount: .escrowedAmount,
    escrowedCreatorPledge: .escrowedCreatorPledge,
    escrowedPredictorStakes: .escrowedPredictorStakes
  }'
echo ""

echo "✅ Tests complete!"
```

---

## Database Queries for Verification

### Check All Escrow Balances

```sql
SELECT 
  id,
  question,
  status,
  "escrowedAmount",
  "escrowedCreatorPledge",
  "escrowedPredictorStakes",
  "creatorPledge",
  "totalStake"
FROM pools
WHERE status != 'settled'
ORDER BY "createdAt" DESC;
```

### Check Transaction Summary

```sql
SELECT 
  type,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM transactions
GROUP BY type
ORDER BY type;
```

### Check Unsettled Escrow

```sql
SELECT 
  SUM("escrowedAmount") as total_escrowed,
  SUM("escrowedCreatorPledge") as total_pledges,
  SUM("escrowedPredictorStakes") as total_stakes
FROM pools
WHERE status != 'settled';
```

---

## Common Issues & Solutions

### Issue: Escrow amount doesn't match
**Solution:** Run integrity check, verify all transactions were created

### Issue: Settlement doesn't distribute funds
**Solution:** Check pool status is CLOSED, verify pool has pledge

### Issue: Transaction not created
**Solution:** Check server logs, verify database connection

### Issue: Wallet balance incorrect
**Solution:** Check for failed transactions, verify escrow operations completed


