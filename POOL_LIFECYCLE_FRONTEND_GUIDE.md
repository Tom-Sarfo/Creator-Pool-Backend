# Pool Lifecycle Frontend Integration Guide - React Router v7

This guide explains how to integrate the automatic pool lifecycle system with a React Router v7 frontend application.

## Overview

The pool lifecycle system automatically transitions pools through states based on:

- Video status changes (unlisted → public)
- Prediction window expiry
- Tracking period expiry (e.g., 7 days)
- Pledge deposits

### Pool Status Flow

```
OPEN → LIVE_TRACKING (when video goes public before window closes)
OPEN → AWAITING_RELEASE (when prediction window expires, video still unlisted)
AWAITING_RELEASE → LIVE_TRACKING (when video goes public)
LIVE_TRACKING → CLOSED (when tracking period expires)
CLOSED → SETTLED (when creator deposits pledge)
```

## API Endpoints

### Pool Management Endpoints

#### GET `/pools`

List pools with optional filters.

**Query Parameters:**

- `status` (optional): Filter by pool status (`open`, `awaiting_release`, `live_tracking`, `closed`, `settled`)
- `creatorId` (optional): Filter by creator ID
- `videoId` (optional): Filter by video ID
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 10): Items per page

**Response:**

```typescript
{
  pools: Pool[];
  total: number;
  page: number;
  limit: number;
}
```

#### GET `/pools/:id`

Get a single pool by ID.

**Response:**

```typescript
Pool;
```

#### GET `/pools/:id/stats`

Get pool statistics including odds, predictions, and time remaining.

**Response:**

```typescript
{
  totalPredictions: number;
  yesPredictions: number;
  noPredictions: number;
  totalStake: number;
  yesStake: number;
  noStake: number;
  participants: number;
  currentOdds: {
    yes: number;
    no: number;
  }
  timeRemaining: number; // milliseconds
}
```

#### POST `/pools/:id/deposit-pledge`

Deposit creator pledge for a pool.

**Authentication:** Required (Creator or Admin)

**Request Body:**

```typescript
{
  amount: number;
}
```

**Response:**

```typescript
Pool; // Updated pool (may be SETTLED if pool was CLOSED)
```

**Behavior:**

- If pool is CLOSED and this is the first pledge deposit, pool automatically transitions to SETTLED
- If pool is OPEN, AWAITING_RELEASE, or LIVE_TRACKING, pledge is added and pool continues normally
- If pool is already SETTLED, returns error

#### GET `/pools/trending`

Get trending pools (most active pools).

**Query Parameters:**

- `limit` (optional, default: 10): Number of pools to return

**Response:**

```typescript
Pool[]
```

#### GET `/pools/search`

Search pools by question.

**Query Parameters:**

- `q`: Search query
- `limit` (optional, default: 20): Number of results

**Response:**

```typescript
Pool[]
```

## Pool Status Types

```typescript
enum PoolStatus {
  OPEN = "open"; // Accepting predictions
  AWAITING_RELEASE = "awaiting_release"; // Prediction window closed, waiting for video to go public
  LIVE_TRACKING = "live_tracking"; // Video is public, tracking metrics
  CLOSED = "closed"; // Tracking period ended
  SETTLED = "settled"; // Results calculated and rewards distributed
}
```

## Pool Entity Structure

```typescript
interface Pool {
  id: string;
  videoId: string;
  creatorId: string;
  question: string;
  targetViews: number;
  trackingDurationDays: number; // e.g., 7
  predictionWindowMinutes: number; // e.g., 43200 (30 days)
  status: PoolStatus;

  // Financials
  totalStake: number;
  creatorPledge: number;
  predictorStakes: number;
  yesStake: number;
  noStake: number;
  yesCount: number;
  noCount: number;
  participants: number;

  // Current metrics
  currentViews: number;
  yesOdds: number | null;
  noOdds: number | null;

  // Results
  result: "yes_won" | "no_won" | "pending";
  creatorEarnings: number;

  // Timestamps
  closesAt: Date | null; // When prediction window closes
  publishedAt: Date | null; // When video went public
  trackingStartedAt: Date | null; // When live tracking began
  closedAt: Date | null; // When tracking period ended
  settledAt: Date | null; // When pool was settled
  createdAt: Date;
  updatedAt: Date;

  // Relations
  video: Video;
  creator: User;
  predictions: Prediction[];
}
```

## Frontend Implementation

### 1. Pool Status Monitoring

Since pool statuses change automatically, you need to poll the API periodically or use WebSocket/SSE if available.

#### Polling Approach

```typescript
// routes/pools.$poolId.tsx
import { useLoaderData, useFetcher } from "react-router";
import { useEffect, useState } from "react";
import type { Route } from "./+types/pools.$poolId";

// Loader
export async function loader({ params }: Route.LoaderArgs) {
  const response = await fetch(`/api/pools/${params.poolId}`);
  if (!response.ok) throw new Error("Failed to load pool");
  return { pool: await response.json() };
}

// Component
export default function PoolDetails(props: Route.ComponentProps) {
  const { pool: initialPool } = useLoaderData<typeof loader>();
  const [pool, setPool] = useState(initialPool);
  const fetcher = useFetcher();

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetcher.load(`/pools/${pool.id}`);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [pool.id, fetcher]);

  // Update pool when fetcher data changes
  useEffect(() => {
    if (fetcher.data?.pool) {
      setPool(fetcher.data.pool);
    }
  }, [fetcher.data]);

  return (
    <div>
      <h1>{pool.question}</h1>
      <PoolStatusBadge status={pool.status} />
      {/* Rest of component */}
    </div>
  );
}
```

### 2. Status Indicators

Create UI components to display pool status:

```typescript
// components/PoolStatusBadge.tsx
interface PoolStatusBadgeProps {
  status: PoolStatus;
}

export function PoolStatusBadge({ status }: PoolStatusBadgeProps) {
  const config = {
    open: { label: "Accepting Predictions", color: "bg-green-500" },
    awaiting_release: {
      label: "Awaiting Video Release",
      color: "bg-yellow-500",
    },
    live_tracking: { label: "Live Tracking", color: "bg-blue-500" },
    closed: { label: "Closed", color: "bg-gray-500" },
    settled: { label: "Settled", color: "bg-purple-500" },
  };

  const { label, color } = config[status];

  return (
    <span className={`px-2 py-1 rounded text-white text-sm ${color}`}>
      {label}
    </span>
  );
}
```

### 3. Countdown Timers

Display countdown timers for prediction window and tracking period:

```typescript
// components/PoolCountdown.tsx
import { useEffect, useState } from "react";

interface PoolCountdownProps {
  pool: Pool;
}

export function PoolCountdown({ pool }: PoolCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      if (pool.status === "open" && pool.closesAt) {
        return Math.max(0, new Date(pool.closesAt).getTime() - Date.now());
      }
      if (pool.status === "live_tracking" && pool.trackingStartedAt) {
        const trackingEnd = new Date(pool.trackingStartedAt);
        trackingEnd.setDate(
          trackingEnd.getDate() + pool.trackingDurationDays
        );
        return Math.max(0, trackingEnd.getTime() - Date.now());
      }
      return 0;
    };

    setTimeRemaining(calculateTimeRemaining());

    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [pool]);

  const formatTime = (ms: number) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
  };

  if (timeRemaining === 0) return null;

  return (
    <div className="text-sm text-gray-600">
      {pool.status === "open" && "Prediction window closes in: "}
      {pool.status === "live_tracking" && "Tracking ends in: "}
      <span className="font-semibold">{formatTime(timeRemaining)}</span>
    </div>
  );
}
```

### 4. Handling Automatic Status Changes

Show alerts or notifications when pool status changes:

```typescript
// components/PoolStatusAlert.tsx
import { useEffect, useState } from "react";

interface PoolStatusAlertProps {
  pool: Pool;
  previousStatus?: PoolStatus;
}

export function PoolStatusAlert({ pool, previousStatus }: PoolStatusAlertProps) {
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (previousStatus && previousStatus !== pool.status) {
      setShowAlert(true);
      const timer = setTimeout(() => setShowAlert(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [pool.status, previousStatus]);

  if (!showAlert) return null;

  const messages = {
    live_tracking: "Video is now public! Pool is live tracking.",
    awaiting_release: "Prediction window closed. Waiting for video release.",
    closed: "Tracking period ended.",
    settled: "Pool has been settled! Check your results.",
  };

  return (
    <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50">
      {messages[pool.status as keyof typeof messages]}
    </div>
  );
}
```

### 5. Creator Pledge Deposit Flow

For creators to deposit pledges on closed pools:

```typescript
// routes/pools.$poolId.deposit-pledge.tsx
import type { Route } from "./+types/pools.$poolId.deposit-pledge";
import { Form, useActionData, useNavigation } from "react-router";
import { depositPledge } from "../lib/api";

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const amount = parseFloat(formData.get("amount") as string);

  try {
    const pool = await depositPledge(params.poolId, amount);
    return { success: true, pool };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default function DepositPledge(props: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (actionData?.success && actionData.pool.status === "settled") {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-green-600 mb-4">
          Pool Settled!
        </h2>
        <p className="text-gray-600">
          Your pledge has been deposited and the pool has been settled.
        </p>
      </div>
    );
  }

  return (
    <Form method="post" className="max-w-md mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Deposit Pledge</h2>

      {actionData?.error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {actionData.error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Amount</label>
        <input
          type="number"
          name="amount"
          min="0"
          step="0.01"
          required
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isSubmitting ? "Depositing..." : "Deposit Pledge"}
      </button>
    </Form>
  );
}
```

### 6. API Client Functions

Create helper functions for API calls:

```typescript
// lib/api.ts
const API_BASE = "/api";

export async function getPool(poolId: string): Promise<Pool> {
  const response = await fetch(`${API_BASE}/pools/${poolId}`);
  if (!response.ok) throw new Error("Failed to fetch pool");
  return response.json();
}

export async function getPoolStats(poolId: string) {
  const response = await fetch(`${API_BASE}/pools/${poolId}/stats`);
  if (!response.ok) throw new Error("Failed to fetch pool stats");
  return response.json();
}

export async function depositPledge(
  poolId: string,
  amount: number
): Promise<Pool> {
  const response = await fetch(`${API_BASE}/pools/${poolId}/deposit-pledge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ amount }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to deposit pledge");
  }
  return response.json();
}

export async function getPools(filters?: {
  status?: PoolStatus;
  creatorId?: string;
  videoId?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.creatorId) params.append("creatorId", filters.creatorId);
  if (filters?.videoId) params.append("videoId", filters.videoId);
  if (filters?.page) params.append("page", filters.page.toString());
  if (filters?.limit) params.append("limit", filters.limit.toString());

  const response = await fetch(`${API_BASE}/pools?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch pools");
  return response.json();
}
```

## User Experience Considerations

### 1. Status Transitions

- Show clear status badges on all pool cards and detail pages
- Use color coding: green (OPEN), yellow (AWAITING_RELEASE), blue (LIVE_TRACKING), gray (CLOSED), purple (SETTLED)
- Display countdown timers for time-sensitive periods

### 2. Prediction Window

- When pool is OPEN: Show prediction form and countdown
- When video goes public: Immediately disable prediction form (pool transitions to LIVE_TRACKING)
- Show message: "Predictions closed - video is now public"

### 3. Tracking Period

- For LIVE_TRACKING pools: Show current view count vs target
- Display progress bar: `(currentViews / targetViews) * 100%`
- Update view count periodically (every 30 seconds or when stats are refreshed)

### 4. Closed Pools

- For CLOSED pools: Show "Awaiting creator pledge deposit"
- For creators: Show deposit pledge button
- When pledge is deposited: Immediately show "Pool Settled" message

### 5. Settled Pools

- Show results: YES won or NO won
- Display payouts for winning predictions
- Show creator earnings if applicable

## Error Handling

Handle common errors:

```typescript
// Error handling example
try {
  const pool = await depositPledge(poolId, amount);
} catch (error) {
  if (error.message.includes("already settled")) {
    // Show error: "Pool is already settled"
  } else if (error.message.includes("Only the pool creator")) {
    // Show error: "Only the pool creator can deposit pledge"
  } else {
    // Show generic error
  }
}
```

## Best Practices

1. **Polling Frequency**: Poll every 30 seconds for active pools (OPEN, LIVE_TRACKING)
2. **Status Caching**: Cache pool status locally and only update on changes
3. **Optimistic Updates**: Update UI optimistically when depositing pledges
4. **Error Boundaries**: Wrap pool components in error boundaries
5. **Loading States**: Show loading indicators during status transitions
6. **Real-time Updates**: If WebSocket/SSE is available, prefer over polling

## Testing Considerations

- Test status transitions: OPEN → LIVE_TRACKING, OPEN → AWAITING_RELEASE, etc.
- Test pledge deposit flow: CLOSED → SETTLED
- Test countdown timers accuracy
- Test polling updates
- Test error handling for edge cases
