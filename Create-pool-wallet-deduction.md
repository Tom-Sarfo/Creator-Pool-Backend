# Create Pool Wallet Deduction - Frontend Integration Guide

## Overview

The backend now handles wallet deduction **atomically** when creating pools or depositing pledges. This means:

- ✅ **Single API call** - No need for separate wallet deduction calls
- ✅ **Atomic operation** - Wallet deduction and pool creation happen together or not at all
- ✅ **Consistent behavior** - Matches how predictions work (stake deducted immediately)
- ✅ **Better error handling** - Fails before pool creation if balance is insufficient

## API Changes

### 1. POST `/api/pools` (Create Pool)

**New Behavior:**
- If `creatorPledge` is provided and > 0, the backend automatically:
  1. Validates creator's wallet balance is sufficient
  2. Deducts the pledge amount from creator's wallet
  3. Creates the pool with the pledge amount
- All operations happen atomically in a single request

**Request (unchanged):**
```typescript
POST /api/pools
Authorization: Bearer <token>
Content-Type: application/json

{
  "videoId": "uuid",
  "question": "Will this video reach 10k views?",
  "targetViews": 10000,
  "creatorPledge": 50.00,  // Optional: amount to pledge
  "predictionWindowMinutes": 15,
  "trackingDurationDays": 7
}
```

**Response (unchanged):**
```typescript
{
  "id": "pool-uuid",
  "videoId": "uuid",
  "creatorId": "creator-uuid",
  "question": "Will this video reach 10k views?",
  "targetViews": 10000,
  "creatorPledge": 50.00,  // Pledge is now deducted from wallet
  "status": "open",
  "createdAt": "2024-01-01T00:00:00Z",
  // ... other pool fields
}
```

**Error Responses (new):**
```typescript
// Insufficient wallet balance
{
  "statusCode": 400,
  "message": "Insufficient wallet balance for pledge",
  "error": "Bad Request"
}
```

### 2. POST `/api/pools/:id/deposit-pledge` (Deposit Pledge)

**New Behavior:**
- The backend now:
  1. Validates creator's wallet balance is sufficient
  2. Deducts the amount from creator's wallet
  3. Updates the pool's pledge amount
- Wallet deduction happens atomically with pledge update

**Request (unchanged):**
```typescript
POST /api/pools/:id/deposit-pledge
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 25.00
}
```

**Response (unchanged):**
```typescript
{
  "id": "pool-uuid",
  "creatorPledge": 75.00,  // Previous 50.00 + new 25.00
  // ... other pool fields
}
```

**Error Responses (new):**
```typescript
// Insufficient wallet balance
{
  "statusCode": 400,
  "message": "Insufficient wallet balance",
  "error": "Bad Request"
}
```

## Migration Guide

### Before (Old Approach - Two API Calls)

**❌ OLD: Separate calls required**
```typescript
// Step 1: Create pool (pledge stored but wallet NOT deducted)
const pool = await createPool({
  videoId: "uuid",
  question: "Will this reach 10k views?",
  targetViews: 10000,
  creatorPledge: 50.00
});

// Step 2: Manually deposit pledge (deduct from wallet)
// This was required to actually deduct funds
try {
  await depositPledge(pool.id, 50.00);
} catch (error) {
  // Pool created but pledge not deposited - inconsistent state!
  console.error("Failed to deposit pledge:", error);
}
```

**Problems:**
- Two API calls required
- Potential for inconsistent state (pool created but pledge not deposited)
- More complex error handling
- Frontend must manage the two-step process

### After (New Approach - Single API Call)

**✅ NEW: Single atomic operation**
```typescript
// Single call - wallet automatically deducted
const pool = await createPool({
  videoId: "uuid",
  question: "Will this reach 10k views?",
  targetViews: 10000,
  creatorPledge: 50.00  // Automatically deducted from wallet
});

// Done! No need for separate deposit-pledge call
```

## Code Examples

### React/TypeScript Example

#### Creating a Pool with Pledge

```typescript
import { useState } from 'react';

interface CreatePoolRequest {
  videoId: string;
  question: string;
  targetViews: number;
  creatorPledge?: number;
  predictionWindowMinutes?: number;
  trackingDurationDays?: number;
}

async function createPool(data: CreatePoolRequest) {
  const response = await fetch('/api/pools', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create pool');
  }

  return response.json();
}

function CreatePoolForm() {
  const [formData, setFormData] = useState({
    videoId: '',
    question: '',
    targetViews: 10000,
    creatorPledge: 0,
  });
  const [walletBalance, setWalletBalance] = useState(100.00);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate wallet balance on frontend first (better UX)
      if (formData.creatorPledge > walletBalance) {
        setError('Insufficient wallet balance');
        setLoading(false);
        return;
      }

      // Single API call - wallet automatically deducted
      const pool = await createPool({
        videoId: formData.videoId,
        question: formData.question,
        targetViews: formData.targetViews,
        creatorPledge: formData.creatorPledge,
      });

      // Update wallet balance optimistically
      setWalletBalance(prev => prev - (formData.creatorPledge || 0));

      // Navigate to pool or show success
      console.log('Pool created:', pool);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pool');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <div>
        <label>Question</label>
        <input
          value={formData.question}
          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
        />
      </div>

      <div>
        <label>Target Views</label>
        <input
          type="number"
          value={formData.targetViews}
          onChange={(e) => setFormData({ ...formData, targetViews: Number(e.target.value) })}
        />
      </div>

      <div>
        <label>
          Creator Pledge
          <span> (Wallet: ${walletBalance.toFixed(2)})</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          max={walletBalance}
          value={formData.creatorPledge}
          onChange={(e) => setFormData({ ...formData, creatorPledge: Number(e.target.value) })}
        />
        {formData.creatorPledge > walletBalance && (
          <div className="error">Insufficient balance</div>
        )}
      </div>

      <button type="submit" disabled={loading || formData.creatorPledge > walletBalance}>
        {loading ? 'Creating...' : 'Create Pool'}
      </button>
    </form>
  );
}
```

#### Depositing Additional Pledge

```typescript
async function depositPledge(poolId: string, amount: number) {
  const response = await fetch(`/api/pools/${poolId}/deposit-pledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({ amount }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to deposit pledge');
  }

  return response.json();
}

function DepositPledgeForm({ poolId, currentWalletBalance }: { poolId: string, currentWalletBalance: number }) {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate wallet balance
      if (amount > currentWalletBalance) {
        setError('Insufficient wallet balance');
        setLoading(false);
        return;
      }

      // Single API call - wallet automatically deducted
      const updatedPool = await depositPledge(poolId, amount);

      // Update local wallet balance
      // You may want to refetch user data to get accurate balance
      
      console.log('Pledge deposited:', updatedPool);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deposit pledge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <div>
        <label>
          Amount
          <span> (Wallet: ${currentWalletBalance.toFixed(2)})</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          max={currentWalletBalance}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>

      <button type="submit" disabled={loading || amount > currentWalletBalance}>
        {loading ? 'Depositing...' : 'Deposit Pledge'}
      </button>
    </form>
  );
}
```

## Error Handling

### New Error Scenarios

1. **Insufficient Wallet Balance (Create Pool)**
   - Status: `400 Bad Request`
   - Message: `"Insufficient wallet balance for pledge"`
   - **Action**: Show error, allow user to reduce pledge or add funds

2. **Insufficient Wallet Balance (Deposit Pledge)**
   - Status: `400 Bad Request`
   - Message: `"Insufficient wallet balance"`
   - **Action**: Show error, allow user to reduce amount or add funds

### Error Handling Best Practices

```typescript
async function handleCreatePool(data: CreatePoolRequest) {
  try {
    const pool = await createPool(data);
    return pool;
  } catch (error) {
    if (error.message.includes('Insufficient wallet balance')) {
      // Handle insufficient balance
      showError('You don\'t have enough funds. Please reduce your pledge or add funds to your wallet.');
      return null;
    }
    
    if (error.message.includes('Video already has an active pool')) {
      showError('This video already has an active pool.');
      return null;
    }
    
    // Handle other errors
    showError('Failed to create pool. Please try again.');
    return null;
  }
}
```

## Best Practices

### 1. Pre-validate Wallet Balance (Better UX)

Validate wallet balance on the frontend before making the API call:

```typescript
if (creatorPledge > walletBalance) {
  showError('Insufficient wallet balance');
  return;
}
```

**Why?** Provides immediate feedback without waiting for API response.

### 2. Update Wallet Balance Optimistically

After successful pool creation or pledge deposit, update wallet balance immediately:

```typescript
const pool = await createPool(data);
// Update wallet balance optimistically
setWalletBalance(prev => prev - data.creatorPledge);
```

**Why?** Better UX - user sees balance update immediately.

### 3. Refetch Wallet Balance After Operations

For accuracy, consider refetching user data after wallet operations:

```typescript
const pool = await createPool(data);
// Refetch user to get accurate wallet balance
await refetchUser();
```

**Why?** Ensures wallet balance matches server state, especially if other operations occurred.

### 4. Show Clear Error Messages

Provide user-friendly error messages:

```typescript
const errorMessages = {
  'Insufficient wallet balance for pledge': 'You don\'t have enough funds. Please reduce your pledge or add funds.',
  'Insufficient wallet balance': 'You don\'t have enough funds for this deposit.',
  'Video already has an active pool': 'This video already has an active pool.',
  'Only the pool creator can deposit pledge': 'Only the pool creator can deposit pledges.',
};
```

### 5. Disable Submit Button When Balance Insufficient

Prevent submission if balance is insufficient:

```typescript
const canSubmit = creatorPledge <= walletBalance && !loading;

<button type="submit" disabled={!canSubmit}>
  Create Pool
</button>
```

### 6. Display Remaining Balance

Show remaining balance after deduction:

```typescript
const remainingBalance = walletBalance - creatorPledge;

<div>
  Pledge: ${creatorPledge}
  Remaining: ${remainingBalance}
</div>
```

## Migration Checklist

- [ ] Remove any separate `depositPledge` calls after `createPool`
- [ ] Update error handling to catch "Insufficient wallet balance" errors
- [ ] Update UI to show wallet balance validation
- [ ] Test with insufficient balance scenario
- [ ] Test with sufficient balance scenario
- [ ] Update wallet balance after successful operations
- [ ] Remove any retry logic for pledge deposits after pool creation

## Testing Scenarios

### Test Case 1: Create Pool with Sufficient Balance
1. User has $100 in wallet
2. Create pool with $50 pledge
3. ✅ Pool created successfully
4. ✅ Wallet balance reduced to $50

### Test Case 2: Create Pool with Insufficient Balance
1. User has $30 in wallet
2. Try to create pool with $50 pledge
3. ✅ Error: "Insufficient wallet balance for pledge"
4. ✅ No pool created
5. ✅ Wallet balance unchanged ($30)

### Test Case 3: Create Pool without Pledge
1. User has $100 in wallet
2. Create pool with $0 pledge (or omit pledge)
3. ✅ Pool created successfully
4. ✅ Wallet balance unchanged ($100)

### Test Case 4: Deposit Pledge with Sufficient Balance
1. Pool exists with $25 pledge
2. User has $50 in wallet
3. Deposit additional $25
4. ✅ Pool pledge updated to $50
5. ✅ Wallet balance reduced to $25

### Test Case 5: Deposit Pledge with Insufficient Balance
1. Pool exists
2. User has $20 in wallet
3. Try to deposit $30
4. ✅ Error: "Insufficient wallet balance"
5. ✅ Pool pledge unchanged
6. ✅ Wallet balance unchanged

## Summary

- ✅ **Simpler frontend code** - Single API call instead of two
- ✅ **Atomic operations** - No risk of inconsistent state
- ✅ **Better error handling** - Clear errors for insufficient balance
- ✅ **Consistent with predictions** - Same pattern across the app
- ✅ **Improved UX** - Immediate feedback on wallet balance

The backend now handles all wallet operations automatically, making the frontend implementation simpler and more reliable.

