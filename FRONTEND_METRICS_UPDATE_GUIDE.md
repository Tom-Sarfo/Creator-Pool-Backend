# Frontend Integration Guide - Metrics & Status Update Improvements

## Overview

The backend has been updated to provide faster and more accurate metrics updates, as well as automatic status transitions. This guide outlines the changes and what frontend developers need to know.

## Backend Changes

### 1. Faster Metrics Updates

**Before:** Metrics were updated every **5 minutes**

**After:** Metrics are now updated every **2 minutes**

**Impact:**

- View counts, like counts, and comment counts update more frequently
- Users will see more up-to-date metrics without manual refresh
- Better real-time feel for pool tracking

### 2. Always Update Metrics

**Before:** Metrics were only updated if `viewCount === 0` or missing

**After:** Metrics are **always updated** on every sync cycle

**Impact:**

- View counts will always reflect the latest YouTube data
- No more stale metrics lingering in the database
- More accurate pool tracking

### 3. Automatic Status Transitions

**Before:** Status transitions (unlisted → public) only happened during manual channel sync

**After:** Status transitions are checked **automatically every 2 minutes**

**Impact:**

- Videos that go public on YouTube will automatically transition to public status
- Pools will automatically transition from `OPEN`/`AWAITING_RELEASE` to `LIVE_TRACKING`
- No need for users to manually sync channel to see status changes

### 4. Integrated Status Checking

**Before:** Status transition checking was not implemented (always returned false)

**After:** Status transitions are checked via YouTube API and integrated into metrics update cycle

**Impact:**

- Automatic detection of videos becoming public
- Seamless pool lifecycle transitions
- Better user experience - changes reflect immediately

## Frontend Recommendations

### 1. Polling Frequency

**Recommendation:** Update your polling/refresh intervals to match the new 2-minute cycle

**Example:**

```typescript
// Before: 5 minutes
const POLL_INTERVAL = 300000; // 5 minutes

// After: 2 minutes (or slightly less for better UX)
const POLL_INTERVAL = 120000; // 2 minutes
```

**Considerations:**

- If you poll every 1-2 minutes, you'll get near-real-time updates
- Balance between responsiveness and API load
- Consider using WebSockets or Server-Sent Events for real-time updates if needed

### 2. Remove Manual Sync Dependencies

**Before:** Users had to manually sync channel to see status changes

**After:** Status changes happen automatically

**Recommendation:**

- **Remove or deprecate** manual "Sync Channel" buttons for status updates
- Keep manual sync for:
  - Initial video discovery
  - Force refresh when needed
  - Recovering from connection issues
- Update UI messaging: "Changes will appear automatically within 2 minutes"

### 3. Real-time Updates

**Option 1: Polling (Simple)**

```typescript
// Poll every 90 seconds for near-real-time updates
useEffect(() => {
  const interval = setInterval(() => {
    fetchVideoMetrics(videoId);
    fetchPoolStatus(poolId);
  }, 90000); // 90 seconds

  return () => clearInterval(interval);
}, [videoId, poolId]);
```

**Option 2: Optimistic Updates**

```typescript
// Show loading state during updates
const [isUpdating, setIsUpdating] = useState(false);

useEffect(() => {
  const interval = setInterval(async () => {
    setIsUpdating(true);
    await fetchLatestMetrics();
    setIsUpdating(false);
  }, 120000);

  return () => clearInterval(interval);
}, []);
```

**Option 3: WebSockets (Advanced)**

```typescript
// If you implement WebSockets, subscribe to metric updates
socket.on("metrics:updated", (data) => {
  updateVideoMetrics(data.videoId, data.metrics);
  updatePoolMetrics(data.poolId, data.currentViews);
});
```

### 4. Status Transition Handling

**Automatic Status Changes:**

- Videos transitioning from unlisted to public will happen automatically
- Pools will automatically transition to `LIVE_TRACKING` when video goes public
- No frontend action needed - just poll for updates

**UI Recommendations:**

```typescript
// Show status indicator when video is transitioning
const VideoStatusBadge = ({ video }) => {
  if (video.status === 'unlisted' && video.hasActivePool) {
    return (
      <Badge variant="warning">
        Unlisted - Will automatically track when public
      </Badge>
    );
  }

  if (video.status === 'public' && pool.status === 'live_tracking') {
    return (
      <Badge variant="success">
        Live Tracking
      </Badge>
    );
  }
};
```

### 5. Error Handling

**Token Revocation:**

- If YouTube tokens are invalid, the backend will automatically clear them
- Frontend should handle "YouTube account needs reconnection" errors gracefully
- Show clear messaging: "Please reconnect your YouTube account to continue tracking"

**Example:**

```typescript
try {
  const metrics = await fetchVideoMetrics(videoId);
  // Handle success
} catch (error) {
  if (error.message.includes("reconnect your YouTube account")) {
    showReconnectYouTubeModal();
  } else {
    showErrorToast("Failed to fetch metrics");
  }
}
```

### 6. Loading States

**Show loading indicators during updates:**

```typescript
const [metrics, setMetrics] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [lastUpdated, setLastUpdated] = useState(null);

useEffect(() => {
  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const data = await fetchVideoMetrics(videoId);
      setMetrics(data);
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  fetchMetrics();
  const interval = setInterval(fetchMetrics, 120000);
  return () => clearInterval(interval);
}, [videoId]);
```

### 7. Optimistic Updates

**Show updated metrics immediately, even if slightly stale:**

```typescript
// Show "Last updated 30 seconds ago" or similar
const LastUpdatedBadge = ({ lastUpdated }) => {
  const secondsAgo = Math.floor((Date.now() - lastUpdated) / 1000);

  if (secondsAgo < 120) {
    return <Badge variant="success">Updated {secondsAgo}s ago</Badge>;
  } else {
    return <Badge variant="warning">Updating...</Badge>;
  }
};
```

## API Endpoints

### No Changes Required

All existing API endpoints remain the same:

- `GET /api/videos/:id` - Get video details
- `GET /api/pools/:id` - Get pool details
- `GET /api/videos/:id/metrics` - Get video metrics
- `POST /api/youtube/sync` - Manual channel sync (still useful for initial sync)

### Response Format

**Video Response:**

```json
{
  "id": "...",
  "youtubeId": "...",
  "title": "...",
  "status": "public", // Now updates automatically
  "visibility": "public",
  "viewCount": 12345, // Updated every 2 minutes
  "likeCount": 456,
  "commentCount": 78,
  "lastSyncedAt": "2025-01-11T10:30:00Z",
  "publishedAt": "2025-01-11T09:00:00Z"
}
```

**Pool Response:**

```json
{
  "id": "...",
  "videoId": "...",
  "status": "live_tracking", // Transitions automatically when video goes public
  "currentViews": 12345, // Updated every 2 minutes
  "publishedAt": "2025-01-11T09:00:00Z",
  "trackingStartedAt": "2025-01-11T09:00:00Z"
}
```

## Migration Checklist

- [ ] Update polling intervals from 5 minutes to 2 minutes (or less)
- [ ] Remove dependency on manual sync for status updates
- [ ] Update UI messaging about automatic updates
- [ ] Add loading states for metric updates
- [ ] Handle "reconnect YouTube" errors gracefully
- [ ] Test status transitions from unlisted to public
- [ ] Test pool transitions to LIVE_TRACKING
- [ ] Verify metrics update frequency in UI
- [ ] Update documentation/user guides about automatic updates

## Testing

### Test Cases

1. **Metrics Update Frequency**

   - Create a pool with a public video
   - Verify metrics update every ~2 minutes
   - Check that view counts always reflect latest data

2. **Status Transitions**

   - Create a pool with an unlisted video
   - Make video public on YouTube
   - Verify video status changes to public within 2 minutes
   - Verify pool status changes to LIVE_TRACKING automatically

3. **Pool Transitions**

   - Create pool in OPEN status with unlisted video
   - Make video public
   - Verify pool transitions to LIVE_TRACKING automatically

4. **Error Handling**
   - Test with invalid YouTube tokens
   - Verify error messages are clear
   - Verify reconnection flow works

## Performance Considerations

- **API Rate Limits:** Backend handles YouTube API rate limits
- **Database Load:** Metrics updates are optimized to batch operations
- **Frontend Load:** Polling every 1-2 minutes is acceptable for most use cases
- **User Experience:** Consider debouncing or throttling rapid updates

## Questions?

If you have questions about these changes or need clarification on any frontend integration points, please refer to:

- Backend API documentation
- Video status transition logic
- Pool lifecycle management

---

**Last Updated:** January 11, 2025
**Backend Version:** Latest (with metrics & status update improvements)








