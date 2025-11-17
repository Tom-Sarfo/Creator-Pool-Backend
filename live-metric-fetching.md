# Live Metric Fetching - Frontend Integration Guide

## Overview

The backend automatically fetches YouTube video metrics (views, likes, comments) every **5 minutes** for all videos that have active pools in `LIVE_TRACKING` status. The frontend can retrieve these updated metrics by polling the API endpoints.

## How It Works

1. **Automatic Updates**: The `MetricsSchedulerService` runs every 5 minutes and updates metrics for all videos being tracked
2. **Real YouTube API**: Metrics are fetched directly from the YouTube Data API using the creator's access token
3. **Database Storage**: Updated metrics are saved to the database and can be retrieved via API endpoints

## Frontend Integration

### Option 1: Polling (Recommended)

Poll the API endpoints periodically to get updated metrics. The backend updates metrics every 5 minutes, so polling every 10-30 seconds is sufficient for near real-time updates.

#### Get Single Video Metrics

```typescript
GET /api/videos/:id/metrics

// Response
{
  viewCount: number;
  likeCount: number;
  commentCount: number;
  lastSyncedAt: string; // ISO date string
}
```

#### Get Video Details (includes metrics)

```typescript
GET /api/videos/:id

// Response includes:
{
  id: string;
  youtubeId: string;
  title: string;
  viewCount: number;        // Updated every 5 minutes
  likeCount: number;         // Updated every 5 minutes
  commentCount: number;      // Updated every 5 minutes
  lastSyncedAt: string;       // Last update timestamp
  // ... other fields
}
```

#### Get Pool Details (includes video metrics)

```typescript
GET /api/pools/:id

// Response includes video with metrics:
{
  id: string;
  currentViews: number;      // Updated from video.viewCount
  targetViews: number;
  video: {
    id: string;
    youtubeId: string;
    viewCount: number;        // Updated every 5 minutes
    likeCount: number;
    commentCount: number;
    lastSyncedAt: string;
    // ... other fields
  }
  // ... other pool fields
}
```

### Implementation Example

```typescript
// React example with polling
import { useEffect, useState } from 'react';

function useLiveMetrics(videoId: string, pollInterval: number = 10000) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/videos/${videoId}/metrics`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setMetrics(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    };

    // Fetch immediately
    fetchMetrics();

    // Then poll every `pollInterval` milliseconds
    const interval = setInterval(fetchMetrics, pollInterval);

    return () => clearInterval(interval);
  }, [videoId, pollInterval]);

  return { metrics, loading };
}

// Usage in component
function VideoMetrics({ videoId }: { videoId: string }) {
  const { metrics, loading } = useLiveMetrics(videoId, 15000); // Poll every 15 seconds

  if (loading) return <div>Loading metrics...</div>;

  return (
    <div>
      <p>Views: {metrics.viewCount.toLocaleString()}</p>
      <p>Likes: {metrics.likeCount.toLocaleString()}</p>
      <p>Comments: {metrics.commentCount.toLocaleString()}</p>
      <small>Last updated: {new Date(metrics.lastSyncedAt).toLocaleString()}</small>
    </div>
  );
}
```

### Polling Best Practices

1. **Poll Interval**: Poll every 10-30 seconds. Since backend updates every 5 minutes, more frequent polling won't provide newer data.

2. **Error Handling**: Implement exponential backoff on errors to avoid overwhelming the server.

```typescript
function useLiveMetricsWithRetry(videoId: string) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [retryDelay, setRetryDelay] = useState(10000);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/videos/${videoId}/metrics`);
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setMetrics(data);
        setError(null);
        setRetryDelay(10000); // Reset delay on success
      } catch (err) {
        setError(err);
        setRetryDelay((prev) => Math.min(prev * 2, 60000)); // Exponential backoff, max 60s
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, retryDelay);
    return () => clearInterval(interval);
  }, [videoId, retryDelay]);

  return { metrics, error };
}
```

3. **Optimize API Calls**: For multiple videos, batch requests or use a single endpoint that returns multiple videos.

```typescript
// Get multiple videos at once
GET /api/videos?hasActivePool=true&status=public

// Response includes all tracked videos with metrics
{
  videos: [
    { id: '...', viewCount: 1000, likeCount: 50, ... },
    { id: '...', viewCount: 2000, likeCount: 100, ... },
  ],
  total: number,
  page: number,
  limit: number
}
```

4. **Stop Polling**: Clear intervals when component unmounts or video is no longer being tracked.

## Manual Sync

If you need immediate metrics update (without waiting for the scheduler), you can manually trigger a sync:

```typescript
POST /api/videos/:id/sync-metrics
Authorization: Bearer <token>

// Response: Updated video object with fresh metrics
```

**Note**: This endpoint is rate-limited and should only be used sparingly. The automatic scheduler handles regular updates.

## Polling Endpoints Summary

| Endpoint                       | Method | Description                                         | Rate Limit |
| ------------------------------ | ------ | --------------------------------------------------- | ---------- |
| `/api/videos/:id/metrics`      | GET    | Get video metrics only                              | 30/min     |
| `/api/videos/:id`              | GET    | Get full video details (includes metrics)           | Standard   |
| `/api/pools/:id`               | GET    | Get pool details (includes video metrics)           | Standard   |
| `/api/videos`                  | GET    | Get list of videos (filter by `hasActivePool=true`) | Standard   |
| `/api/videos/:id/sync-metrics` | POST   | Manually trigger metrics sync                       | Moderate   |

## Query Parameters for Filtering

When fetching videos, you can filter to get only videos being tracked:

```typescript
GET /api/videos?hasActivePool=true&status=public

// Query parameters:
// - creatorId: Filter by creator
// - status: Filter by status (public, unlisted, private)
// - hasActivePool: Filter by active pool status (true/false)
// - page: Page number for pagination
// - limit: Items per page
```

## Important Notes

1. **Update Frequency**: Backend updates metrics every 5 minutes. Don't poll more frequently than every 10 seconds.

2. **Token Refresh**: The backend automatically refreshes YouTube access tokens when needed. No action required from the frontend.

3. **No Updates for Disconnected Creators**: If a creator disconnects their YouTube account, metrics won't update. Check `lastSyncedAt` to see if updates are stale.

4. **Rate Limiting**: The `/api/videos/:id/metrics` endpoint has rate limiting (30 requests per minute). Use pagination and filtering when fetching multiple videos.

5. **Caching**: Consider caching metrics on the frontend and only updating when `lastSyncedAt` changes.

## Example: Complete Pool View with Live Metrics

```typescript
function PoolView({ poolId }: { poolId: string }) {
  const [pool, setPool] = useState(null);

  useEffect(() => {
    const fetchPool = async () => {
      const response = await fetch(`/api/pools/${poolId}`);
      const data = await response.json();
      setPool(data);
    };

    fetchPool();
    // Poll every 20 seconds for updated metrics
    const interval = setInterval(fetchPool, 20000);
    return () => clearInterval(interval);
  }, [poolId]);

  if (!pool) return <div>Loading...</div>;

  const progress = (pool.video.viewCount / pool.targetViews) * 100;

  return (
    <div>
      <h2>{pool.video.title}</h2>
      <div>
        <p>Current Views: {pool.video.viewCount.toLocaleString()}</p>
        <p>Target Views: {pool.targetViews.toLocaleString()}</p>
        <div className="progress-bar">
          <div style={{ width: `${progress}%` }} />
        </div>
        <p>{progress.toFixed(1)}% of target</p>
      </div>
      <small>
        Last updated: {new Date(pool.video.lastSyncedAt).toLocaleString()}
      </small>
    </div>
  );
}
```

## Troubleshooting

### Metrics Not Updating

1. **Check `lastSyncedAt`**: If it's more than 5 minutes old, there might be an issue with the scheduler or YouTube API.

2. **Verify Pool Status**: Metrics only update for videos with pools in `LIVE_TRACKING` status.

3. **Check Creator Connection**: Ensure the video's creator has a connected YouTube account with valid tokens.

4. **API Errors**: Check server logs for YouTube API errors. Token refresh failures will prevent updates.

### Stale Data

If metrics seem stale:

1. Check the `lastSyncedAt` timestamp
2. Manually trigger a sync using `POST /api/videos/:id/sync-metrics`
3. Verify the pool is in `LIVE_TRACKING` status






