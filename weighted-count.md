# Frontend Integration Guide: Weighted-Count Probability Model

## Overview

This guide explains how to migrate from the old odds-based system to the new weighted-count probability model. The new system uses `sqrt(stake)` as weights to calculate probabilities, providing a fairer representation of prediction sentiment.

## ✅ Backend Status

**The backend has been fully updated** and is ready to return the new probability fields:

- ✅ `ProbabilityService` implemented with weighted probability calculations
- ✅ Pool entity updated with `probabilityYes` and `probabilityNo` columns
- ✅ All API endpoints updated to return probabilities
- ✅ `POST /predictions` returns `potentialPayout` and `updatedProbabilities`

**⚠️ Database Migration Required**: Before the backend can return these fields, the database migration must be run. See `migrations/001_add_probability_columns.sql` and `migrations/README.md` for instructions.

---

## 🧮 Understanding the New System

### Weight Formula

Each prediction's weight is calculated using:

```
weight = sqrt(stake)
```

### Probability Calculation

Probabilities are calculated based on weighted sums:

```
P_yes = (Σ weights of all "Yes" predictions) / (Σ weights of all predictions)
P_no = 1 - P_yes
```

### Potential Payout Formula

Potential payout is calculated dynamically:

```
potentialPayout = (userStake / totalStakeOnUserSide) * totalPool
```

**Capped at:** `(totalPool * 0.94) * 0.8` (80% of net pool after 6% house edge)

---

## 📊 API Response Changes

### Pool Object Changes

#### Old Format (Odds)

```typescript
interface Pool {
  // ... other fields
  yesOdds?: number | null; // e.g., 2.5
  noOdds?: number | null; // e.g., 1.5
}
```

#### New Format (Probabilities)

```typescript
interface Pool {
  // ... other fields
  probabilityYes: number; // e.g., 0.6820 (68.20%)
  probabilityNo: number; // e.g., 0.3180 (31.80%)

  // Deprecated fields (still present for backwards compatibility)
  yesOdds?: number | null; // @deprecated - Use probabilityYes
  noOdds?: number | null; // @deprecated - Use probabilityNo
}
```

**Important:**

- `probabilityYes` and `probabilityNo` are values between 0 and 1
- They always sum to 1.0 (or very close due to rounding)
- Display as percentages: multiply by 100

### Prediction Object Changes

#### Create Prediction Response

**Old Response:**

```typescript
interface CreatePredictionResponse {
  prediction: Prediction;
  updatedOdds: {
    yes: number;
    no: number;
  };
}
```

**New Response:**

```typescript
interface CreatePredictionResponse {
  prediction: Prediction;
  potentialPayout: number; // Calculated potential payout
  updatedProbabilities: {
    probabilityYes: number; // 0-1 range
    probabilityNo: number; // 0-1 range
  };
}
```

### Pool Stats Response

**Old Response:**

```typescript
interface PoolStatsResponse {
  // ... other fields
  currentOdds: {
    yes: number;
    no: number;
  };
}
```

**New Response:**

```typescript
interface PoolStatsResponse {
  // ... other fields
  probabilityYes: number; // 0-1 range
  probabilityNo: number; // 0-1 range
}
```

---

## 🔄 Migration Steps

### Step 1: Update TypeScript Interfaces

Update your frontend type definitions:

```typescript
// types/pool.ts

export interface Pool {
  id: string;
  videoId: string;
  creatorId: string;
  question: string;
  targetViews: number;
  status: PoolStatus;

  // Financials
  totalStake: number;
  yesStake: number;
  noStake: number;
  yesCount: number;
  noCount: number;
  participants: number;

  // NEW: Probabilities (0-1 range)
  probabilityYes: number;
  probabilityNo: number;

  // Deprecated - Remove after migration
  // yesOdds?: number | null;
  // noOdds?: number | null;

  // ... other fields
}

export interface CreatePredictionResponse {
  prediction: Prediction;
  potentialPayout: number;
  updatedProbabilities: {
    probabilityYes: number;
    probabilityNo: number;
  };
}

export interface PoolStatsResponse {
  totalPredictions: number;
  yesPredictions: number;
  noPredictions: number;
  totalStake: number;
  yesStake: number;
  noStake: number;
  participants: number;
  probabilityYes: number; // NEW
  probabilityNo: number; // NEW
  timeRemaining: number;
}
```

### Step 2: Update Display Components

#### Probability Display Component

**Before (Odds):**

```tsx
function ProbabilityDisplay({ pool }: { pool: Pool }) {
  const yesOdds = pool.yesOdds || 0;
  const noOdds = pool.noOdds || 0;

  return (
    <div>
      <div>Yes: {yesOdds}x</div>
      <div>No: {noOdds}x</div>
    </div>
  );
}
```

**After (Probabilities):**

```tsx
function ProbabilityDisplay({ pool }: { pool: Pool }) {
  const yesPercentage = (pool.probabilityYes * 100).toFixed(1);
  const noPercentage = (pool.probabilityNo * 100).toFixed(1);

  return (
    <div>
      <div>Yes: {yesPercentage}%</div>
      <div>No: {noPercentage}%</div>
    </div>
  );
}
```

#### Enhanced Probability Display with Bars

```tsx
function ProbabilityDisplay({ pool }: { pool: Pool }) {
  const yesPercentage = pool.probabilityYes * 100;
  const noPercentage = pool.probabilityNo * 100;

  return (
    <div className="probability-display">
      <div className="probability-row">
        <span className="label">Yes</span>
        <div className="bar-container">
          <div className="bar yes-bar" style={{ width: `${yesPercentage}%` }} />
          <span className="percentage">{yesPercentage.toFixed(1)}%</span>
        </div>
      </div>
      <div className="probability-row">
        <span className="label">No</span>
        <div className="bar-container">
          <div className="bar no-bar" style={{ width: `${noPercentage}%` }} />
          <span className="percentage">{noPercentage.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Update Potential Payout Display

**Before (Odds-based calculation):**

```tsx
function PotentialPayout({ prediction, pool }: Props) {
  // Old calculation (not accurate with new system)
  const odds = prediction.choice === "yes" ? pool.yesOdds : pool.noOdds;
  const potentialPayout = prediction.stake * (1 + odds);

  return <div>Potential Payout: ${potentialPayout.toFixed(2)}</div>;
}
```

**After (API-provided value):**

```tsx
function PotentialPayout({ prediction }: { prediction: Prediction }) {
  const potentialPayout = prediction.potentialPayout || 0;

  return (
    <div className="potential-payout">
      <span className="label">Potential Payout:</span>
      <span className="amount">${potentialPayout.toFixed(2)}</span>
    </div>
  );
}
```

#### After Creating Prediction

```tsx
async function handleCreatePrediction(data: CreatePredictionDto) {
  const response = await fetch("/api/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result: CreatePredictionResponse = await response.json();

  // result.potentialPayout is the calculated payout
  // result.updatedProbabilities contains the new probabilities
  console.log("Potential Payout:", result.potentialPayout);
  console.log("Updated Probabilities:", result.updatedProbabilities);

  // Update UI with new probabilities
  updatePoolProbabilities(result.updatedProbabilities);
}
```

### Step 4: Update Pool List Components

```tsx
function PoolCard({ pool }: { pool: Pool }) {
  const yesPercentage = (pool.probabilityYes * 100).toFixed(1);
  const noPercentage = (pool.probabilityNo * 100).toFixed(1);

  return (
    <div className="pool-card">
      <h3>{pool.question}</h3>
      <div className="probabilities">
        <div className="prob-item">
          <span className="choice">Yes</span>
          <span className="percent">{yesPercentage}%</span>
        </div>
        <div className="prob-item">
          <span className="choice">No</span>
          <span className="percent">{noPercentage}%</span>
        </div>
      </div>
      <div className="stakes">
        <span>Total: ${pool.totalStake}</span>
        <span>Yes: ${pool.yesStake}</span>
        <span>No: ${pool.noStake}</span>
      </div>
    </div>
  );
}
```

### Step 5: Update Calculation Helpers (if any)

Remove any frontend odds calculations. All calculations are now done on the backend.

**Remove:**

```typescript
// ❌ Don't calculate on frontend
function calculateOdds(yesStake: number, noStake: number) {
  // Old odds logic
}
```

**Use API values:**

```typescript
// ✅ Use values from API
function displayProbabilities(pool: Pool) {
  return {
    yes: pool.probabilityYes * 100,
    no: pool.probabilityNo * 100,
  };
}
```

---

## 📝 Example Calculation

### Backend Example

Given predictions:

- Predictor A: YES, stake = 100
- Predictor B: YES, stake = 25
- Predictor C: NO, stake = 49

**Weight Calculation:**

```
weight_A = sqrt(100) = 10
weight_B = sqrt(25) = 5
weight_C = sqrt(49) = 7
```

**Probability Calculation:**

```
totalYesWeight = 10 + 5 = 15
totalNoWeight = 7
totalWeight = 15 + 7 = 22

probabilityYes = 15 / 22 = 0.6818 (68.18%)
probabilityNo = 7 / 22 = 0.3182 (31.82%)
```

**Potential Payout for Predictor A (if pool ends now):**

```
totalPool = 100 + 25 + 49 = 174
totalYesStake = 125

potentialPayout = (100 / 125) * 174 = 139.2
cap = (174 * 0.94) * 0.8 = 130.848

finalPayout = min(139.2, 130.848) = 130.85
```

### Frontend Display

```tsx
// Display probabilities
<div>Yes: 68.18%</div>
<div>No: 31.82%</div>

// Display potential payout for user's prediction
<div>Your potential payout: $130.85</div>
```

---

## ✅ Migration Checklist

### Backend Checklist (Already Completed)

- [x] Backend code updated with `ProbabilityService`
- [x] Pool entity updated with probability columns
- [x] API endpoints updated to return probabilities
- [ ] **Database migration run** (See `migrations/README.md`)

### Frontend Checklist

- [ ] Update TypeScript interfaces to include `probabilityYes` and `probabilityNo`
- [ ] Remove or deprecate `yesOdds` and `noOdds` from interfaces
- [ ] Update all probability display components to show percentages
- [ ] Update potential payout displays to use API-provided values
- [ ] Remove any frontend odds calculations
- [ ] Update `CreatePredictionResponse` interface
- [ ] Update `PoolStatsResponse` interface
- [ ] Test probability displays across all pool-related components
- [ ] Test potential payout calculations after creating predictions
- [ ] Update any charts/graphs that displayed odds
- [ ] Update documentation/comments referencing odds
- [ ] Verify API responses include probability fields (after backend migration is run)

---

## 🎨 UI/UX Recommendations

### Probability Display

1. **Always show as percentages** (multiply by 100)
2. **Format to 1 decimal place** for readability: `68.2%`
3. **Use visual bars** to make proportions clear
4. **Ensure percentages sum to 100%** (may be 99.9% or 100.1% due to rounding)

### Potential Payout Display

1. **Show prominently** when user has a prediction
2. **Update dynamically** after new predictions are made
3. **Display currency formatted**: `$166.67`
4. **Note that it's an estimate**: "Potential payout (estimate)"
5. **Only show for open pools**

### Color Coding

Consider using colors to represent probability:

- Green shades for higher probabilities
- Red shades for lower probabilities
- Neutral gray for 50/50

---

## 🔍 Testing

### Test Cases

1. **Empty Pool**: Probabilities should be 50/50
2. **Single Prediction**: Should show correct probability
3. **Multiple Predictions**: Probabilities should update correctly
4. **Large Stakes**: Verify sqrt weighting prevents domination
5. **Potential Payout**: Should be capped correctly
6. **Pool Updates**: Probabilities update when new predictions arrive

### Example Test Data

```typescript
const testPool = {
  id: "test-1",
  yesStake: 600,
  noStake: 400,
  totalStake: 1000,
  probabilityYes: 0.682, // sqrt(600) / (sqrt(600) + sqrt(400))
  probabilityNo: 0.318,
};

const testPrediction = {
  id: "pred-1",
  stake: 100,
  choice: "yes",
  potentialPayout: 166.67, // (100 / 600) * 1000, capped
};
```

---

## 🚨 Important Notes

1. **Backwards Compatibility**: Old `yesOdds` and `noOdds` fields are deprecated but still present. Do not use them for new logic.

2. **Probability Range**: Always between 0 and 1. Multiply by 100 for percentage display.

3. **Precision**: Backend returns probabilities with 4 decimal places (e.g., 0.6820). Round appropriately for display.

4. **Dynamic Updates**: Probabilities and potential payouts update automatically when predictions are added/removed.

5. **House Edge**: 6% total (5% platform + 1% creator). This is accounted for in potential payout calculations.

6. **Capping**: Potential payouts are capped at 80% of net pool (after house edge) for display fairness.

---

## 📚 API Endpoints Reference

### GET /pools/:id

Returns pool with `probabilityYes` and `probabilityNo` fields.

### POST /predictions

Returns:

```typescript
{
  prediction: Prediction;
  potentialPayout: number;
  updatedProbabilities: {
    probabilityYes: number;
    probabilityNo: number;
  }
}
```

### GET /pools/:id/stats

Returns pool stats including `probabilityYes` and `probabilityNo`.

---

## 🔧 Troubleshooting

### Probabilities don't sum to 100%

Due to rounding, probabilities may sum to 99.9% or 100.1%. This is normal. Display as-is or normalize if needed.

### Potential payout seems incorrect

Verify:

1. Are you using the value from the API response?
2. Is the pool still open?
3. Check if cap is being applied correctly

### Old odds still appearing

Backend still returns deprecated fields for backwards compatibility. Use `probabilityYes` and `probabilityNo` instead.

---

## 📞 Support

If you encounter issues during migration:

1. Check API responses match expected format
2. Verify TypeScript interfaces are updated
3. Ensure all display components use probability values (not odds)
4. Test with actual API calls, not mock data

---

**Migration Complete!** 🎉

You should now be using the weighted-count probability model throughout your frontend application.
