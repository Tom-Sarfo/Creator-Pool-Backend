# Escrow System Frontend Integration Guide

## Overview

This guide covers integrating the escrow system into your frontend application. The escrow system ensures all stakes and pledges are held securely until pool settlement, then distributes funds to winners, creators, and the platform.

## Table of Contents

1. [Type Definitions](#type-definitions)
2. [API Response Changes](#api-response-changes)
3. [Component Updates](#component-updates)
4. [Transaction History](#transaction-history)
5. [UI/UX Considerations](#uiux-considerations)
6. [Step-by-Step Integration](#step-by-step-integration)
7. [Testing Checklist](#testing-checklist)

---

## Type Definitions

### Updated Pool Interface

Add these new fields to your `Pool` interface:

```typescript
export interface Pool {
  // ... existing fields ...
  
  // Escrow fields (NEW)
  escrowedAmount: number;              // Total amount in escrow
  escrowedCreatorPledge: number;        // Creator pledge in escrow
  escrowedPredictorStakes: number;     // Total predictor stakes in escrow
  platformFeeCollected: number;        // Platform fee collected on settlement
  creatorRoyaltyCollected: number;     // Creator royalty collected on settlement
}
```

### Transaction Interface (NEW)

Create a new interface for transaction records:

```typescript
export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  STAKE = 'stake',
  PLEDGE = 'pledge',
  WINNINGS = 'winnings',
  ROYALTY = 'royalty',
  PLATFORM_FEE = 'platform_fee',
  REFUND = 'refund',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Transaction {
  id: string;
  userId: string;
  poolId: string | null;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string | null;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  // Optional relations
  pool?: Pool;
  user?: User;
}

export interface TransactionFilters {
  userId?: string;
  poolId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}
```

---

## API Response Changes

### 1. GET `/api/pools/:id` - Updated Response

The pool response now includes escrow fields:

```typescript
// Before
{
  id: "pool-uuid",
  creatorPledge: 50.00,
  totalStake: 25.00,
  // ... other fields
}

// After (NEW fields added)
{
  id: "pool-uuid",
  creatorPledge: 50.00,
  totalStake: 25.00,
  // NEW ESCROW FIELDS
  escrowedAmount: 75.00,              // 50 pledge + 25 stake
  escrowedCreatorPledge: 50.00,
  escrowedPredictorStakes: 25.00,
  platformFeeCollected: 0.00,         // 0 until settlement
  creatorRoyaltyCollected: 0.00,      // 0 until settlement
  // ... other fields
}
```

### 2. POST `/api/pools` - Create Pool (No Changes)

The API endpoint remains the same, but the response now includes escrow fields:

```typescript
POST /api/pools
Authorization: Bearer <token>
Content-Type: application/json

{
  "videoId": "uuid",
  "question": "Will this video reach 10k views?",
  "targetViews": 10000,
  "creatorPledge": 50.00
}

// Response includes escrow fields
{
  "id": "pool-uuid",
  "creatorPledge": 50.00,
  "escrowedAmount": 50.00,           // NEW
  "escrowedCreatorPledge": 50.00,    // NEW
  "escrowedPredictorStakes": 0.00,   // NEW
  // ... other fields
}
```

### 3. POST `/api/predictions` - Create Prediction (No Changes)

The API endpoint remains the same, but funds are now held in escrow:

```typescript
POST /api/predictions
Authorization: Bearer <token>
Content-Type: application/json

{
  "poolId": "pool-uuid",
  "choice": "yes",
  "stake": 25.00
}

// Response unchanged, but stake is now in escrow
{
  "prediction": { ... },
  "potentialPayout": 75.50,
  "updatedProbabilities": { ... }
}
```

### 4. POST `/api/pools/:id/settle` - Settle Pool (Enhanced Response)

The settlement response now includes distribution details:

```typescript
POST /api/pools/:id/settle
Authorization: Bearer <token>

// Response
{
  "id": "pool-uuid",
  "status": "settled",
  "result": "yes_won",
  "settledAt": "2024-01-15T10:30:00Z",
  // NEW ESCROW FIELDS
  "escrowedAmount": 0.00,            // Cleared after settlement
  "platformFeeCollected": 1.50,      // 5% of losing side
  "creatorRoyaltyCollected": 0.30,    // 1% of losing side
  "creatorEarnings": 0.30,
  // ... other fields
}
```

### 5. GET `/api/transactions` - Transaction History (NEW ENDPOINT)

**Note:** You may need to add this endpoint to your backend. See backend implementation guide.

```typescript
GET /api/transactions?userId=<user-id>&type=stake&page=1&limit=20
Authorization: Bearer <token>

// Response
{
  "transactions": [
    {
      "id": "trans-uuid",
      "userId": "user-uuid",
      "poolId": "pool-uuid",
      "type": "stake",
      "amount": 25.00,
      "status": "completed",
      "description": "Deposited 25.00 to escrow for pool pool-uuid",
      "createdAt": "2024-01-15T10:00:00Z",
      "pool": {
        "id": "pool-uuid",
        "question": "Will this video reach 10k views?",
        // ... pool details
      }
    },
    // ... more transactions
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

---

## Component Updates

### 1. Pool Card Component

Update to show escrow status:

```typescript
// components/PoolCard.tsx
import { Pool } from '@/types';

interface PoolCardProps {
  pool: Pool;
}

export function PoolCard({ pool }: PoolCardProps) {
  return (
    <div className="pool-card">
      <h3>{pool.question}</h3>
      
      {/* Existing pool info */}
      <div className="pool-stats">
        <span>Total Stake: ${pool.totalStake.toFixed(2)}</span>
        <span>Creator Pledge: ${pool.creatorPledge.toFixed(2)}</span>
      </div>

      {/* NEW: Escrow Status */}
      {pool.status !== 'settled' && pool.escrowedAmount > 0 && (
        <div className="escrow-status">
          <span className="escrow-badge">
            💰 ${pool.escrowedAmount.toFixed(2)} in escrow
          </span>
          <div className="escrow-breakdown">
            <small>Pledge: ${pool.escrowedCreatorPledge.toFixed(2)}</small>
            <small>Stakes: ${pool.escrowedPredictorStakes.toFixed(2)}</small>
          </div>
        </div>
      )}

      {/* Settlement info */}
      {pool.status === 'settled' && (
        <div className="settlement-info">
          <div>Platform Fee: ${pool.platformFeeCollected.toFixed(2)}</div>
          <div>Creator Royalty: ${pool.creatorRoyaltyCollected.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
```

### 2. Pool Details Page

Show detailed escrow information:

```typescript
// routes/pool-details.tsx
import { useLoaderData } from 'react-router';
import type { Route } from './+types/pool-details';

export default function PoolDetailsPage({ loaderData }: Route.ComponentProps) {
  const pool = loaderData.pool;

  return (
    <div className="pool-details">
      <h1>{pool.question}</h1>

      {/* Pool Status */}
      <div className="status-section">
        <StatusBadge status={pool.status} />
      </div>

      {/* NEW: Escrow Information */}
      <section className="escrow-section">
        <h2>Escrow Status</h2>
        <div className="escrow-card">
          <div className="escrow-total">
            <span className="label">Total in Escrow:</span>
            <span className="amount">${pool.escrowedAmount.toFixed(2)}</span>
          </div>
          
          <div className="escrow-breakdown">
            <div className="breakdown-item">
              <span>Creator Pledge</span>
              <span>${pool.escrowedCreatorPledge.toFixed(2)}</span>
            </div>
            <div className="breakdown-item">
              <span>Predictor Stakes</span>
              <span>${pool.escrowedPredictorStakes.toFixed(2)}</span>
            </div>
          </div>

          {pool.status === 'settled' && (
            <div className="settlement-breakdown">
              <h3>Settlement Details</h3>
              <div className="breakdown-item">
                <span>Platform Fee (5%)</span>
                <span>${pool.platformFeeCollected.toFixed(2)}</span>
              </div>
              <div className="breakdown-item">
                <span>Creator Royalty (1%)</span>
                <span>${pool.creatorRoyaltyCollected.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Existing pool details */}
      {/* ... */}
    </div>
  );
}
```

### 3. Create Pool Form

Update to show escrow information:

```typescript
// routes/create-pool.tsx
'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { createPool } from '@/api/pools';

export default function CreatePoolForm() {
  const { user, refetchUser } = useUser();
  const [formData, setFormData] = useState({
    videoId: '',
    question: '',
    targetViews: 10000,
    creatorPledge: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate wallet balance
      if (formData.creatorPledge > user.walletBalance) {
        setError('Insufficient wallet balance');
        setLoading(false);
        return;
      }

      // Create pool (pledge automatically moves to escrow)
      const pool = await createPool(formData);

      // Refetch user to get updated wallet balance
      await refetchUser();

      // Show success message
      alert(`Pool created! $${formData.creatorPledge.toFixed(2)} moved to escrow.`);

      // Navigate to pool details
      navigate(`/pools/${pool.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create pool');
    } finally {
      setLoading(false);
    }
  };

  const remainingBalance = user.walletBalance - formData.creatorPledge;

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}

      {/* Existing form fields */}
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

      {/* Pledge Input with Escrow Info */}
      <div>
        <label>
          Creator Pledge
          <span className="wallet-info">
            (Wallet: ${user.walletBalance.toFixed(2)})
          </span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          max={user.walletBalance}
          value={formData.creatorPledge}
          onChange={(e) => setFormData({ ...formData, creatorPledge: Number(e.target.value) })}
        />
        
        {formData.creatorPledge > 0 && (
          <div className="escrow-info">
            <small>
              💰 ${formData.creatorPledge.toFixed(2)} will be held in escrow until pool settlement
            </small>
            <small>
              Remaining balance: ${remainingBalance.toFixed(2)}
            </small>
          </div>
        )}

        {formData.creatorPledge > user.walletBalance && (
          <div className="error">Insufficient balance</div>
        )}
      </div>

      <button 
        type="submit" 
        disabled={loading || formData.creatorPledge > user.walletBalance}
      >
        {loading ? 'Creating...' : 'Create Pool'}
      </button>
    </form>
  );
}
```

### 4. Prediction Form

Update to show escrow information:

```typescript
// components/PredictionForm.tsx
'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { createPrediction } from '@/api/predictions';

interface PredictionFormProps {
  poolId: string;
  onSuccess?: () => void;
}

export function PredictionForm({ poolId, onSuccess }: PredictionFormProps) {
  const { user, refetchUser } = useUser();
  const [choice, setChoice] = useState<'yes' | 'no'>('yes');
  const [stake, setStake] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate wallet balance
      if (stake > user.walletBalance) {
        setError('Insufficient wallet balance');
        setLoading(false);
        return;
      }

      // Create prediction (stake automatically moves to escrow)
      const result = await createPrediction({
        poolId,
        choice,
        stake,
      });

      // Refetch user to get updated wallet balance
      await refetchUser();

      // Show success message
      alert(`Prediction placed! $${stake.toFixed(2)} moved to escrow.`);

      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create prediction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}

      <div>
        <label>Your Choice</label>
        <div className="choice-buttons">
          <button
            type="button"
            className={choice === 'yes' ? 'active' : ''}
            onClick={() => setChoice('yes')}
          >
            Yes
          </button>
          <button
            type="button"
            className={choice === 'no' ? 'active' : ''}
            onClick={() => setChoice('no')}
          >
            No
          </button>
        </div>
      </div>

      <div>
        <label>
          Stake Amount
          <span className="wallet-info">
            (Wallet: ${user.walletBalance.toFixed(2)})
          </span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          max={user.walletBalance}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
        />

        {stake > 0 && (
          <div className="escrow-info">
            <small>
              💰 ${stake.toFixed(2)} will be held in escrow until pool settlement
            </small>
            {result?.potentialPayout && (
              <small>
                Potential payout: ${result.potentialPayout.toFixed(2)}
              </small>
            )}
          </div>
        )}

        {stake > user.walletBalance && (
          <div className="error">Insufficient balance</div>
        )}
      </div>

      <button 
        type="submit" 
        disabled={loading || stake > user.walletBalance || stake <= 0}
      >
        {loading ? 'Placing...' : 'Place Prediction'}
      </button>
    </form>
  );
}
```

### 5. Wallet Balance Component

Update to show escrowed amounts:

```typescript
// components/WalletBalance.tsx
'use client';

import { useUser } from '@/hooks/useUser';
import { useQuery } from '@tanstack/react-query';
import { getEscrowedAmount } from '@/api/wallet';

export function WalletBalance() {
  const { user } = useUser();
  
  // Fetch total escrowed amount across all pools
  const { data: escrowedTotal } = useQuery({
    queryKey: ['escrowed-amount', user?.id],
    queryFn: () => getEscrowedAmount(user.id),
    enabled: !!user,
  });

  const availableBalance = user.walletBalance;
  const escrowed = escrowedTotal || 0;
  const totalBalance = availableBalance + escrowed;

  return (
    <div className="wallet-balance">
      <div className="balance-card">
        <div className="balance-item">
          <span className="label">Available Balance</span>
          <span className="amount">${availableBalance.toFixed(2)}</span>
        </div>
        
        {escrowed > 0 && (
          <div className="balance-item escrowed">
            <span className="label">In Escrow</span>
            <span className="amount">${escrowed.toFixed(2)}</span>
            <small>Held until pool settlement</small>
          </div>
        )}

        <div className="balance-item total">
          <span className="label">Total Balance</span>
          <span className="amount">${totalBalance.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
```

---

## Transaction History

### 1. Transaction History Component

```typescript
// components/TransactionHistory.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '@/api/transactions';
import { Transaction, TransactionType } from '@/types';
import { format } from 'date-fns';

interface TransactionHistoryProps {
  userId?: string;
  poolId?: string;
  limit?: number;
}

export function TransactionHistory({ 
  userId, 
  poolId, 
  limit = 20 
}: TransactionHistoryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', userId, poolId],
    queryFn: () => getTransactions({ userId, poolId, limit }),
    enabled: !!userId || !!poolId,
  });

  if (isLoading) return <div>Loading transactions...</div>;
  if (!data?.transactions.length) return <div>No transactions found</div>;

  return (
    <div className="transaction-history">
      <h3>Transaction History</h3>
      <div className="transaction-list">
        {data.transactions.map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))}
      </div>
    </div>
  );
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const getTypeLabel = (type: TransactionType) => {
    const labels = {
      deposit: 'Deposit',
      withdrawal: 'Withdrawal',
      stake: 'Stake',
      pledge: 'Pledge',
      winnings: 'Winnings',
      royalty: 'Royalty',
      platform_fee: 'Platform Fee',
      refund: 'Refund',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: TransactionType) => {
    if (['winnings', 'royalty', 'deposit'].includes(type)) return 'green';
    if (['stake', 'pledge', 'withdrawal'].includes(type)) return 'red';
    return 'gray';
  };

  const isPositive = ['winnings', 'royalty', 'deposit'].includes(transaction.type);
  const sign = isPositive ? '+' : '-';

  return (
    <div className={`transaction-item ${transaction.status}`}>
      <div className="transaction-main">
        <div className="transaction-type">
          <span className={`type-badge ${getTypeColor(transaction.type)}`}>
            {getTypeLabel(transaction.type)}
          </span>
          {transaction.pool && (
            <span className="pool-link">
              {transaction.pool.question}
            </span>
          )}
        </div>
        <div className="transaction-amount">
          <span className={isPositive ? 'positive' : 'negative'}>
            {sign}${Math.abs(transaction.amount).toFixed(2)}
          </span>
        </div>
      </div>
      <div className="transaction-meta">
        <span className="date">
          {format(new Date(transaction.createdAt), 'MMM d, yyyy h:mm a')}
        </span>
        <span className={`status ${transaction.status}`}>
          {transaction.status}
        </span>
      </div>
      {transaction.description && (
        <div className="transaction-description">
          {transaction.description}
        </div>
      )}
    </div>
  );
}
```

### 2. Transaction History Page

```typescript
// routes/transactions.tsx
import { useLoaderData } from 'react-router';
import type { Route } from './+types/transactions';
import { TransactionHistory } from '@/components/TransactionHistory';

export default function TransactionsPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="transactions-page">
      <h1>Transaction History</h1>
      <TransactionHistory userId={loaderData.userId} />
    </div>
  );
}
```

### 3. API Functions

```typescript
// api/transactions.ts
import { Transaction, TransactionFilters, PaginatedTransactions } from '@/types';

const API_BASE = '/api';

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<PaginatedTransactions> {
  const params = new URLSearchParams();
  if (filters.userId) params.append('userId', filters.userId);
  if (filters.poolId) params.append('poolId', filters.poolId);
  if (filters.type) params.append('type', filters.type);
  if (filters.status) params.append('status', filters.status);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());

  const response = await fetch(`${API_BASE}/transactions?${params}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch transactions');
  }

  return response.json();
}

export async function getPoolTransactions(poolId: string): Promise<Transaction[]> {
  const response = await fetch(`${API_BASE}/pools/${poolId}/transactions`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch pool transactions');
  }

  return response.json();
}
```

---

## UI/UX Considerations

### 1. Escrow Status Indicators

Add visual indicators for escrow status:

```css
/* escrow-status.css */
.escrow-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 0.5rem;
  color: #0369a1;
  font-weight: 500;
}

.escrow-breakdown {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

.escrow-info {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-left: 3px solid #0ea5e9;
  border-radius: 0.25rem;
}

.escrow-info small {
  display: block;
  color: #475569;
  margin-top: 0.25rem;
}
```

### 2. Transaction Type Badges

Style transaction types with colors:

```css
/* transaction-types.css */
.type-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.type-badge.green {
  background: #dcfce7;
  color: #166534;
}

.type-badge.red {
  background: #fee2e2;
  color: #991b1b;
}

.type-badge.gray {
  background: #f1f5f9;
  color: #475569;
}

.transaction-item {
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
}

.transaction-item .positive {
  color: #16a34a;
  font-weight: 600;
}

.transaction-item .negative {
  color: #dc2626;
  font-weight: 600;
}
```

### 3. Loading States

Show loading states during escrow operations:

```typescript
// components/EscrowLoadingState.tsx
export function EscrowLoadingState() {
  return (
    <div className="escrow-loading">
      <div className="spinner" />
      <p>Processing escrow transaction...</p>
      <small>Please wait while we secure your funds</small>
    </div>
  );
}
```

### 4. Success Messages

Show clear success messages:

```typescript
// hooks/useEscrowNotification.ts
export function useEscrowNotification() {
  const showNotification = (message: string, type: 'success' | 'error') => {
    // Your notification system (toast, alert, etc.)
    toast(message, { type });
  };

  return {
    showEscrowDeposit: (amount: number, type: 'pledge' | 'stake') => {
      showNotification(
        `$${amount.toFixed(2)} ${type === 'pledge' ? 'pledge' : 'stake'} moved to escrow`,
        'success'
      );
    },
    showEscrowRelease: (amount: number, type: 'winnings' | 'royalty') => {
      showNotification(
        `$${amount.toFixed(2)} ${type === 'winnings' ? 'winnings' : 'royalty'} released from escrow`,
        'success'
      );
    },
  };
}
```

---

## Step-by-Step Integration

### Step 1: Update Type Definitions

1. Add escrow fields to `Pool` interface
2. Create `Transaction` interface and enums
3. Update existing types if needed

**File:** `types/pool.ts` or `types/index.ts`

```typescript
// Add to your existing Pool interface
export interface Pool {
  // ... existing fields ...
  escrowedAmount: number;
  escrowedCreatorPledge: number;
  escrowedPredictorStakes: number;
  platformFeeCollected: number;
  creatorRoyaltyCollected: number;
}
```

### Step 2: Update API Functions

1. Update pool API functions to handle new fields
2. Create transaction API functions
3. Add error handling for escrow-related errors

**File:** `api/pools.ts`

```typescript
// Update existing functions - no changes needed to request/response handling
// The new fields will automatically be included in responses

// Add new function for escrow info (optional)
export async function getPoolEscrowInfo(poolId: string) {
  const pool = await getPoolById(poolId);
  return {
    escrowedAmount: pool.escrowedAmount,
    escrowedCreatorPledge: pool.escrowedCreatorPledge,
    escrowedPredictorStakes: pool.escrowedPredictorStakes,
  };
}
```

**File:** `api/transactions.ts` (NEW)

```typescript
// Create new file with transaction API functions
// See Transaction History section above for full implementation
```

### Step 3: Update Pool Components

1. Update `PoolCard` to show escrow status
2. Update `PoolDetails` to show escrow breakdown
3. Update `CreatePoolForm` to show escrow info
4. Update `PredictionForm` to show escrow info

**Files to update:**
- `components/PoolCard.tsx`
- `routes/pool-details.tsx`
- `routes/create-pool.tsx`
- `components/PredictionForm.tsx`

### Step 4: Add Transaction History

1. Create `TransactionHistory` component
2. Create `TransactionItem` component
3. Add transaction history page/route
4. Add transaction API functions

**Files to create:**
- `components/TransactionHistory.tsx`
- `routes/transactions.tsx`
- `api/transactions.ts`

### Step 5: Update Wallet Display

1. Update wallet balance component
2. Show available vs escrowed amounts
3. Add escrow breakdown tooltip/modal

**File:** `components/WalletBalance.tsx`

### Step 6: Add Escrow Status to Settlement

1. Update settlement display to show distribution
2. Show platform fee and creator royalty
3. Display transaction records for settlement

**File:** `routes/pool-settlement.tsx` or settlement component

### Step 7: Update Error Handling

1. Handle escrow-related errors
2. Show user-friendly error messages
3. Add retry logic for failed transactions

**File:** `utils/errorHandling.ts`

```typescript
export function handleEscrowError(error: any): string {
  if (error.message?.includes('Insufficient wallet balance')) {
    return 'You don\'t have enough funds. Please reduce the amount or add funds to your wallet.';
  }
  if (error.message?.includes('Insufficient escrow balance')) {
    return 'Escrow balance error. Please contact support.';
  }
  return error.message || 'An error occurred with the escrow transaction.';
}
```

### Step 8: Add Loading States

1. Add loading states for escrow operations
2. Show progress indicators
3. Disable forms during processing

### Step 9: Testing

1. Test pool creation with pledge
2. Test prediction creation
3. Test settlement and distribution
4. Test transaction history
5. Test error scenarios

---

## Testing Checklist

### Functional Testing

- [ ] Pool creation with pledge moves funds to escrow
- [ ] Pool creation updates wallet balance correctly
- [ ] Prediction creation moves stake to escrow
- [ ] Prediction creation updates wallet balance correctly
- [ ] Escrow amounts display correctly on pool cards
- [ ] Escrow breakdown shows correct amounts
- [ ] Settlement distributes funds correctly
- [ ] Winners receive payouts
- [ ] Creator receives royalty
- [ ] Platform fee is tracked
- [ ] Transaction history displays correctly
- [ ] Transaction filters work correctly
- [ ] Wallet balance shows available vs escrowed

### UI/UX Testing

- [ ] Escrow badges display correctly
- [ ] Transaction type colors are correct
- [ ] Loading states show during operations
- [ ] Success messages appear after operations
- [ ] Error messages are user-friendly
- [ ] Forms validate wallet balance
- [ ] Escrow info tooltips/modal work
- [ ] Mobile responsive design works

### Edge Cases

- [ ] Insufficient balance errors handled
- [ ] Zero escrow amounts display correctly
- [ ] Settled pools show correct escrow (should be 0)
- [ ] Multiple transactions display correctly
- [ ] Large amounts format correctly
- [ ] Transaction pagination works

### Integration Testing

- [ ] API responses include escrow fields
- [ ] Wallet balance updates after operations
- [ ] Transaction records created correctly
- [ ] Pool status updates correctly
- [ ] Settlement triggers correctly

---

## Migration Notes

### Backward Compatibility

The escrow fields are **additive** - existing code will continue to work. The new fields are optional in the response, so:

- ✅ Existing components will work without changes
- ✅ New fields can be added gradually
- ✅ No breaking changes to API

### Gradual Rollout

You can integrate escrow features gradually:

1. **Phase 1:** Update types, show escrow amounts (read-only)
2. **Phase 2:** Add transaction history
3. **Phase 3:** Add escrow breakdown UI
4. **Phase 4:** Add settlement details

### Data Migration

No frontend data migration needed. The backend handles all escrow logic. Frontend only needs to:
- Display new fields
- Handle new error cases
- Show transaction history

---

## Example: Complete Integration Flow

### Creating a Pool with Pledge

```typescript
// 1. User fills form
const formData = {
  videoId: 'video-uuid',
  question: 'Will this reach 10k views?',
  targetViews: 10000,
  creatorPledge: 50.00,
};

// 2. Frontend validates
if (formData.creatorPledge > user.walletBalance) {
  showError('Insufficient balance');
  return;
}

// 3. API call (unchanged)
const pool = await createPool(formData);

// 4. Response includes escrow fields (NEW)
console.log(pool.escrowedAmount); // 50.00
console.log(pool.escrowedCreatorPledge); // 50.00

// 5. Update UI
// - Show success message with escrow info
// - Update wallet balance (refetch user)
// - Navigate to pool details
// - Display escrow badge on pool card
```

### Making a Prediction

```typescript
// 1. User fills form
const predictionData = {
  poolId: 'pool-uuid',
  choice: 'yes',
  stake: 25.00,
};

// 2. Frontend validates
if (predictionData.stake > user.walletBalance) {
  showError('Insufficient balance');
  return;
}

// 3. API call (unchanged)
const result = await createPrediction(predictionData);

// 4. Update UI
// - Show success: "$25.00 moved to escrow"
// - Update wallet balance
// - Refresh pool to show updated escrow
// - Show transaction in history
```

### Viewing Settlement

```typescript
// 1. Pool is settled
const pool = await getPoolById(poolId);

// 2. Display settlement info
if (pool.status === 'settled') {
  // Show distribution breakdown
  console.log('Platform Fee:', pool.platformFeeCollected);
  console.log('Creator Royalty:', pool.creatorRoyaltyCollected);
  console.log('Escrow Cleared:', pool.escrowedAmount === 0);
}

// 3. Show transaction history
const transactions = await getPoolTransactions(poolId);
// Display winnings, royalty, platform fee transactions
```

---

## Troubleshooting

### Issue: Escrow fields not showing

**Solution:**
- Check API response includes escrow fields
- Verify TypeScript types are updated
- Check component is reading correct fields

### Issue: Wallet balance not updating

**Solution:**
- Refetch user data after operations
- Check API response includes updated balance
- Verify state management updates correctly

### Issue: Transaction history empty

**Solution:**
- Verify transaction endpoint exists
- Check user has transactions
- Verify filters are correct
- Check API authentication

### Issue: Escrow amounts don't match

**Solution:**
- Verify pool data is fresh (refetch)
- Check for rounding errors in display
- Verify backend calculation logic

---

## Additional Resources

- Backend API Documentation: See `ESCROW_IMPLEMENTATION_GUIDE.md`
- Testing Guide: See `ESCROW_TESTING_GUIDE.md`
- Backend Types: See `src/entities/pool.entity.ts` and `src/entities/transaction.entity.ts`

---

## Summary

The escrow system integration requires:

1. ✅ **Type Updates** - Add escrow fields to Pool interface, create Transaction interface
2. ✅ **Component Updates** - Show escrow status in pool cards, details, forms
3. ✅ **Transaction History** - Display transaction records
4. ✅ **Wallet Display** - Show available vs escrowed amounts
5. ✅ **Error Handling** - Handle escrow-related errors
6. ✅ **UI Polish** - Add badges, colors, loading states

The integration is **non-breaking** - existing code continues to work while you add escrow features gradually.

