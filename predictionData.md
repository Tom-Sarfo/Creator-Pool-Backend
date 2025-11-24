# Predictor Data Integration Guide

## Overview

This guide explains how to fetch and integrate real-time prediction data for a particular predictor in your frontend application. You'll learn how to get statistics like active predictions count, total predictions, win rate, and total earnings.

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Data Structures](#data-structures)
3. [Frontend Integration](#frontend-integration)
4. [Real-Time Updates](#real-time-updates)
5. [Complete Example](#complete-example)

---

## API Endpoints

### 1. Get Current User's Prediction Statistics

**Endpoint**: `GET /predictions/me/stats`

**Authentication**: Required (JWT Bearer Token)

**Description**: Returns comprehensive statistics for the authenticated user's predictions.

**Request**:

```http
GET /predictions/me/stats
Authorization: Bearer <your-jwt-token>
```

**Response**:

```typescript
interface PredictionStats {
  totalPredictions: number; // Total number of predictions made
  wonPredictions: number; // Number of winning predictions
  lostPredictions: number; // Number of losing predictions
  pendingPredictions: number; // Active predictions (not yet settled)
  totalEarnings: number; // Total earnings from won predictions
  totalStaked: number; // Total amount staked across all predictions
  winRate: number; // Win rate percentage (0-100)
}
```

**Example Response**:

```json
{
  "totalPredictions": 45,
  "wonPredictions": 28,
  "lostPredictions": 12,
  "pendingPredictions": 5,
  "totalEarnings": 1250.5,
  "totalStaked": 890.0,
  "winRate": 70.0
}
```

### 2. Get Current User's Predictions List

**Endpoint**: `GET /predictions/me`

**Authentication**: Required (JWT Bearer Token)

**Description**: Returns all predictions made by the authenticated user, ordered by most recent first.

**Request**:

```http
GET /predictions/me
Authorization: Bearer <your-jwt-token>
```

**Response**: Array of prediction objects with full details including pool and video information.

**Example Response**:

```json
[
  {
    "id": "uuid-here",
    "poolId": "pool-uuid",
    "predictorId": "user-uuid",
    "choice": "yes",
    "stake": 50.0,
    "potentialPayout": 75.5,
    "actualPayout": null,
    "result": "pending",
    "settledAt": null,
    "predictedAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "pool": {
      "id": "pool-uuid",
      "question": "Will this video reach 100K views in 7 days?",
      "status": "live_tracking",
      "targetViews": 100000,
      "currentViews": 85000,
      "probabilityYes": 0.65,
      "probabilityNo": 0.35
    },
    "pool.video": {
      "id": "video-uuid",
      "title": "My Amazing Video",
      "youtubeVideoId": "dQw4w9WgXcQ"
    }
  }
]
```

### 3. Get Specific User's Predictions (Admin Only)

**Endpoint**: `GET /predictions/user/:userId`

**Authentication**: Required (JWT Bearer Token + Admin Role)

**Description**: Admin-only endpoint to get predictions for any user by their ID.

### 4. Get Specific User's Stats (Admin Only)

**Endpoint**: `GET /predictions/user/:userId/stats`

**Authentication**: Required (JWT Bearer Token + Admin Role)

**Description**: Admin-only endpoint to get statistics for any user by their ID.

---

## Data Structures

### Prediction Entity

```typescript
interface Prediction {
  id: string; // UUID
  poolId: string; // UUID of the pool
  predictorId: string; // UUID of the predictor (user)
  choice: "yes" | "no"; // Prediction choice
  stake: number; // Amount staked
  potentialPayout: number | null; // Calculated potential payout
  actualPayout: number | null; // Actual payout if won
  result: "won" | "lost" | "pending"; // Prediction result
  settledAt: Date | null; // When prediction was settled
  predictedAt: Date; // When prediction was made
  updatedAt: Date; // Last update timestamp
  pool?: Pool; // Related pool object (if included)
}
```

### Prediction Statistics

```typescript
interface PredictionStats {
  totalPredictions: number; // All predictions (won + lost + pending)
  wonPredictions: number; // Predictions that won
  lostPredictions: number; // Predictions that lost
  pendingPredictions: number; // Active predictions (not yet settled)
  totalEarnings: number; // Sum of actualPayout from won predictions
  totalStaked: number; // Sum of all stakes
  winRate: number; // (wonPredictions / totalPredictions) * 100
}
```

**Key Metrics Explained**:

- **Active Predictions** (`pendingPredictions`): Predictions that are still waiting for the pool to settle. These are predictions where `result === "pending"`.

- **Total Predictions** (`totalPredictions`): The sum of all predictions regardless of status.

- **Win Rate** (`winRate`): Calculated as `(wonPredictions / totalPredictions) * 100`. Only counts settled predictions (won + lost), not pending ones.

- **Total Earnings** (`totalEarnings`): Sum of `actualPayout` from all won predictions. This is the net profit (doesn't include the original stake back).

- **Total Staked** (`totalStaked`): Sum of all `stake` amounts across all predictions. This represents total investment.

---

## Frontend Integration

### Step 1: Setup API Client

Create a utility function to handle authenticated API requests:

```typescript
// utils/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
}

async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    throw new Error("No authentication token found");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, handle refresh or redirect to login
      throw new Error("Authentication failed");
    }
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

export const predictionApi = {
  getMyStats: () => apiRequest<PredictionStats>("/predictions/me/stats"),
  getMyPredictions: () => apiRequest<Prediction[]>("/predictions/me"),
};
```

### Step 2: Create React Hook for Prediction Stats

```typescript
// hooks/usePredictionStats.ts
import { useState, useEffect } from "react";
import { predictionApi, PredictionStats } from "../utils/api";

interface UsePredictionStatsReturn {
  stats: PredictionStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePredictionStats(): UsePredictionStatsReturn {
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await predictionApi.getMyStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}
```

### Step 3: Create React Hook for Predictions List

```typescript
// hooks/useMyPredictions.ts
import { useState, useEffect } from "react";
import { predictionApi, Prediction } from "../utils/api";

interface UseMyPredictionsReturn {
  predictions: Prediction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMyPredictions(): UseMyPredictionsReturn {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await predictionApi.getMyPredictions();
      setPredictions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch predictions"
      );
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  return {
    predictions,
    loading,
    error,
    refetch: fetchPredictions,
  };
}
```

### Step 4: Create Stats Display Component

```typescript
// components/PredictorStats.tsx
import React from 'react';
import { usePredictionStats } from '../hooks/usePredictionStats';

export function PredictorStats() {
  const { stats, loading, error } = usePredictionStats();

  if (loading) {
    return <div>Loading stats...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!stats) {
    return <div>No stats available</div>;
  }

  return (
    <div className="predictor-stats">
      <h2>Your Prediction Statistics</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Active Predictions</h3>
          <p className="stat-value">{stats.pendingPredictions}</p>
          <p className="stat-label">Currently tracking</p>
        </div>

        <div className="stat-card">
          <h3>Total Predictions</h3>
          <p className="stat-value">{stats.totalPredictions}</p>
          <p className="stat-label">All time</p>
        </div>

        <div className="stat-card">
          <h3>Win Rate</h3>
          <p className="stat-value">{stats.winRate.toFixed(1)}%</p>
          <p className="stat-label">
            {stats.wonPredictions} wins / {stats.wonPredictions + stats.lostPredictions} settled
          </p>
        </div>

        <div className="stat-card">
          <h3>Total Earnings</h3>
          <p className="stat-value">${stats.totalEarnings.toFixed(2)}</p>
          <p className="stat-label">From {stats.wonPredictions} wins</p>
        </div>

        <div className="stat-card">
          <h3>Total Staked</h3>
          <p className="stat-value">${stats.totalStaked.toFixed(2)}</p>
          <p className="stat-label">Total investment</p>
        </div>

        <div className="stat-card">
          <h3>Net Profit</h3>
          <p className="stat-value">
            ${(stats.totalEarnings - stats.totalStaked).toFixed(2)}
          </p>
          <p className="stat-label">Earnings - Staked</p>
        </div>
      </div>
    </div>
  );
}
```

---

## Real-Time Updates

### Strategy 1: Polling (Simple)

For real-time updates, you can poll the stats endpoint at regular intervals:

```typescript
// hooks/usePredictionStats.ts (Enhanced with polling)
import { useState, useEffect, useRef } from "react";
import { predictionApi, PredictionStats } from "../utils/api";

interface UsePredictionStatsOptions {
  pollInterval?: number; // Poll interval in milliseconds (default: 30000 = 30s)
  enabled?: boolean; // Enable/disable polling
}

export function usePredictionStats(
  options: UsePredictionStatsOptions = {}
): UsePredictionStatsReturn {
  const { pollInterval = 30000, enabled = true } = options;
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = async () => {
    try {
      setError(null);
      const data = await predictionApi.getMyStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
      // Don't clear stats on error, keep showing last known data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Setup polling if enabled
    if (enabled && pollInterval > 0) {
      intervalRef.current = setInterval(fetchStats, pollInterval);
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pollInterval, enabled]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}
```

**Usage**:

```typescript
// Poll every 10 seconds
const { stats } = usePredictionStats({ pollInterval: 10000 });

// Disable polling (fetch once)
const { stats } = usePredictionStats({ enabled: false });
```

### Strategy 2: WebSocket (Advanced)

For true real-time updates, implement WebSocket connection:

```typescript
// hooks/usePredictionStatsWebSocket.ts
import { useState, useEffect, useRef } from "react";
import { PredictionStats } from "../utils/api";

interface UsePredictionStatsWebSocketOptions {
  enabled?: boolean;
}

export function usePredictionStatsWebSocket(
  options: UsePredictionStatsWebSocketOptions = {}
): UsePredictionStatsReturn {
  const { enabled = true } = options;
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setError("No authentication token found");
      setLoading(false);
      return;
    }

    // Connect to WebSocket endpoint
    const ws = new WebSocket(
      `ws://localhost:3000/predictions/stats?token=${token}`
    );

    ws.onopen = () => {
      setError(null);
      setLoading(false);
    };

    ws.onmessage = (event) => {
      try {
        const data: PredictionStats = JSON.parse(event.data);
        setStats(data);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      setError("WebSocket connection error");
      setLoading(false);
    };

    ws.onclose = () => {
      // Optionally attempt to reconnect
      console.log("WebSocket closed");
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled]);

  const refetch = async () => {
    // For WebSocket, refetch means requesting an update
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "refresh" }));
    }
  };

  return {
    stats,
    loading,
    error,
    refetch,
  };
}
```

**Note**: WebSocket support needs to be implemented on the backend. For now, use polling.

### Strategy 3: Optimistic Updates with Manual Refresh

Update stats immediately after user actions (like creating a prediction):

```typescript
// After creating a prediction
const handleCreatePrediction = async (predictionData) => {
  try {
    const result = await predictionApi.createPrediction(predictionData);

    // Optimistically update stats
    if (stats) {
      setStats({
        ...stats,
        totalPredictions: stats.totalPredictions + 1,
        pendingPredictions: stats.pendingPredictions + 1,
        totalStaked: stats.totalStaked + predictionData.stake,
      });
    }

    // Refetch to get accurate data
    await refetch();
  } catch (error) {
    // Handle error
  }
};
```

---

## Complete Example

Here's a complete React component that displays predictor statistics with real-time updates:

```typescript
// pages/dashboard.tsx or components/Dashboard.tsx
import React, { useState } from 'react';
import { usePredictionStats } from '../hooks/usePredictionStats';
import { useMyPredictions } from '../hooks/useMyPredictions';

export function Dashboard() {
  const [pollInterval, setPollInterval] = useState(30000); // 30 seconds
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } =
    usePredictionStats({ pollInterval });
  const { predictions, loading: predictionsLoading, refetch: refetchPredictions } =
    useMyPredictions();

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchPredictions()]);
  };

  if (statsLoading) {
    return <div>Loading dashboard...</div>;
  }

  if (statsError) {
    return (
      <div>
        <p>Error: {statsError}</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Prediction Dashboard</h1>
        <div className="controls">
          <label>
            Update Interval:
            <select
              value={pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value))}
            >
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
              <option value={0}>Manual only</option>
            </select>
          </label>
          <button onClick={handleRefresh}>Refresh Now</button>
        </div>
      </div>

      {stats && (
        <div className="stats-section">
          <div className="stat-card highlight">
            <h3>Active Predictions</h3>
            <p className="stat-value large">{stats.pendingPredictions}</p>
            <p className="stat-label">Currently being tracked</p>
          </div>

          <div className="stat-card">
            <h3>Total Predictions</h3>
            <p className="stat-value">{stats.totalPredictions}</p>
            <p className="stat-label">
              {stats.wonPredictions} won, {stats.lostPredictions} lost, {stats.pendingPredictions} pending
            </p>
          </div>

          <div className="stat-card">
            <h3>Win Rate</h3>
            <p className="stat-value">{stats.winRate.toFixed(1)}%</p>
            <p className="stat-label">
              {stats.wonPredictions} wins out of {stats.wonPredictions + stats.lostPredictions} settled
            </p>
          </div>

          <div className="stat-card highlight">
            <h3>Total Earnings</h3>
            <p className="stat-value large">${stats.totalEarnings.toFixed(2)}</p>
            <p className="stat-label">From {stats.wonPredictions} winning predictions</p>
          </div>

          <div className="stat-card">
            <h3>Total Staked</h3>
            <p className="stat-value">${stats.totalStaked.toFixed(2)}</p>
            <p className="stat-label">Total amount invested</p>
          </div>

          <div className="stat-card">
            <h3>Net Profit/Loss</h3>
            <p className={`stat-value ${stats.totalEarnings - stats.totalStaked >= 0 ? 'positive' : 'negative'}`}>
              ${(stats.totalEarnings - stats.totalStaked).toFixed(2)}
            </p>
            <p className="stat-label">Earnings minus staked amount</p>
          </div>
        </div>
      )}

      <div className="predictions-section">
        <h2>Recent Predictions</h2>
        {predictionsLoading ? (
          <div>Loading predictions...</div>
        ) : (
          <div className="predictions-list">
            {predictions.map((prediction) => (
              <div key={prediction.id} className="prediction-item">
                <div className="prediction-header">
                  <span className={`status-badge ${prediction.result}`}>
                    {prediction.result}
                  </span>
                  <span className="prediction-date">
                    {new Date(prediction.predictedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="prediction-details">
                  <p><strong>Pool:</strong> {prediction.pool?.question}</p>
                  <p><strong>Choice:</strong> {prediction.choice.toUpperCase()}</p>
                  <p><strong>Stake:</strong> ${prediction.stake.toFixed(2)}</p>
                  {prediction.actualPayout && (
                    <p><strong>Payout:</strong> ${prediction.actualPayout.toFixed(2)}</p>
                  )}
                  {prediction.potentialPayout && prediction.result === 'pending' && (
                    <p><strong>Potential Payout:</strong> ${prediction.potentialPayout.toFixed(2)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Best Practices

### 1. Error Handling

Always handle authentication errors and token expiration:

```typescript
try {
  const stats = await predictionApi.getMyStats();
} catch (error) {
  if (error.message === "Authentication failed") {
    // Redirect to login or refresh token
    handleTokenRefresh();
  } else {
    // Show error message to user
    showError("Failed to load prediction stats");
  }
}
```

### 2. Loading States

Show appropriate loading indicators:

```typescript
if (loading) {
  return <SkeletonLoader />;
}
```

### 3. Caching

Consider caching stats data to reduce API calls:

```typescript
// Use React Query or SWR for automatic caching and refetching
import useSWR from "swr";

const { data: stats, error } = useSWR(
  "/predictions/me/stats",
  predictionApi.getMyStats,
  { refreshInterval: 30000 }
);
```

### 4. Optimistic Updates

Update UI immediately after user actions, then sync with server:

```typescript
// After creating prediction
setStats((prev) => ({
  ...prev,
  pendingPredictions: prev.pendingPredictions + 1,
  totalPredictions: prev.totalPredictions + 1,
}));

// Then refetch to get accurate data
await refetch();
```

### 5. Polling Considerations

- **Poll Interval**: 30 seconds is a good default. Adjust based on your needs.
- **Background Polling**: Only poll when the tab is active (use `document.visibilityState`).
- **Battery Optimization**: Reduce polling frequency on mobile devices.
- **Network Optimization**: Stop polling when offline, resume when online.

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Pause polling
    } else {
      // Resume polling
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () =>
    document.removeEventListener("visibilitychange", handleVisibilityChange);
}, []);
```

---

## Summary

To integrate predictor data in your frontend:

1. **Use the endpoint**: `GET /predictions/me/stats` to get statistics
2. **Use the endpoint**: `GET /predictions/me` to get prediction list
3. **Implement polling**: Set up automatic refresh every 30 seconds (or your preferred interval)
4. **Handle errors**: Properly handle authentication and network errors
5. **Show loading states**: Display loading indicators while fetching data
6. **Optimistic updates**: Update UI immediately after user actions

The key metrics available are:

- **Active Predictions**: `pendingPredictions` - predictions waiting to be settled
- **Total Predictions**: `totalPredictions` - all predictions made
- **Win Rate**: `winRate` - percentage of settled predictions that won
- **Total Earnings**: `totalEarnings` - sum of payouts from won predictions

For real-time updates, implement polling with a reasonable interval (30 seconds recommended) or wait for WebSocket support to be added to the backend.
