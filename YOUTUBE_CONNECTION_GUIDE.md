# YouTube Connection Integration Guide - Frontend

## Overview

This guide explains how to successfully connect a user's YouTube channel to the Creator Pool platform. The connection uses OAuth 2.0 flow with Google's YouTube API.

## Prerequisites

1. **Backend API** must be running and accessible
2. **User must be authenticated** (have a valid JWT token)
3. **User must have CREATOR or ADMIN role**
4. **Backend environment variables** configured:
   - `YOUTUBE_CLIENT_ID`
   - `YOUTUBE_CLIENT_SECRET`
   - `YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback` (or your backend URL)
   - `FRONTEND_URL=http://localhost:5179` (or your frontend URL)

## Connection Flow Diagram

```
┌─────────┐         ┌──────────┐         ┌──────────────┐         ┌─────────┐
│Frontend │         │ Backend  │         │ Google OAuth │         │YouTube  │
└────┬────┘         └────┬─────┘         └──────┬───────┘         └────┬────┘
     │                   │                      │                      │
     │ 1. GET /auth-url  │                      │                      │
     │──────────────────>│                      │                      │
     │                   │                      │                      │
     │ 2. Returns        │                      │                      │
     │    OAuth URL      │                      │                      │
     │<──────────────────│                      │                      │
     │                   │                      │                      │
     │ 3. Redirect user  │                      │                      │
     │    to OAuth URL   │                      │                      │
     │─────────────────────────────────────────>│                      │
     │                   │                      │                      │
     │                   │                      │ 4. User authorizes   │
     │                   │                      │    & grants access  │
     │                   │                      │<────────────────────│
     │                   │                      │                      │
     │                   │                      │ 5. Redirect with code│
     │                   │<────────────────────│                      │
     │                   │                      │                      │
     │                   │ 6. Exchange code    │                      │
     │                   │    for tokens       │                      │
     │                   │───────────────────────────────────────────>│
     │                   │                      │                      │
     │                   │ 7. Get channel info │                      │
     │                   │    & sync videos    │                      │
     │                   │───────────────────────────────────────────>│
     │                   │                      │                      │
     │                   │ 8. Redirect to      │                      │
     │                   │    frontend         │                      │
     │<────────────────────────────────────────────────────────────────│
     │                   │                      │                      │
     │ 9. Show success   │                      │                      │
     │    & refresh data │                      │                      │
     │                   │                      │                      │
```

## Step-by-Step Implementation

### Step 1: Create a YouTube Connection Service/Function

```typescript
// services/youtubeConnection.service.ts or utils/youtube.ts

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

/**
 * Initiate YouTube connection
 * Call this when user clicks "Connect YouTube" button
 */
export async function initiateYouTubeConnection(
  token: string
): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/youtube/auth-url`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get YouTube authorization URL");
    }

    const data = await response.json();

    if (!data.success || !data.authUrl) {
      throw new Error("Invalid response from server");
    }

    return data.authUrl;
  } catch (error) {
    console.error("Error initiating YouTube connection:", error);
    throw error;
  }
}
```

### Step 2: Handle the Connection Flow

```typescript
// In your React component or page (e.g., CreatorDashboard.tsx)

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function CreatorDashboard() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [youtubeStatus, setYoutubeStatus] = useState<any>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get JWT token from your auth system
  const token = localStorage.getItem('accessToken'); // or from your auth context

  // Handle OAuth callback (when user returns from Google)
  useEffect(() => {
    const youtubeParam = searchParams.get('youtube');

    if (youtubeParam === 'connected') {
      const message = searchParams.get('message');
      // Show success message
      console.log('YouTube connected successfully!', message);

      // Refresh YouTube status
      checkYouTubeStatus();

      // Clean up URL
      setSearchParams({});
    } else if (youtubeParam === 'error') {
      const reason = searchParams.get('reason');
      // Show error message
      console.error('YouTube connection failed:', reason);

      // Show user-friendly error
      alert(`Failed to connect YouTube: ${reason || 'Unknown error'}`);

      // Clean up URL
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Function to start YouTube connection
  const handleConnectYouTube = async () => {
    if (!token) {
      alert('Please login first');
      return;
    }

    setIsConnecting(true);

    try {
      // Step 1: Get the OAuth URL from backend
      const authUrl = await initiateYouTubeConnection(token);

      // Step 2: Redirect user to Google OAuth page
      // This will open in the same window/tab
      window.location.href = authUrl;

      // Note: After this, user will be redirected to Google,
      // then back to your backend callback endpoint,
      // which will redirect to your frontend with success/error params

    } catch (error) {
      console.error('Error connecting YouTube:', error);
      alert(`Failed to start YouTube connection: ${error.message}`);
      setIsConnecting(false);
    }
  };

  // Check YouTube connection status
  const checkYouTubeStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/youtube/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setYoutubeStatus(data);
      }
    } catch (error) {
      console.error('Error checking YouTube status:', error);
    }
  };

  // Load status on component mount
  useEffect(() => {
    if (token) {
      checkYouTubeStatus();
    }
  }, [token]);

  return (
    <div>
      <h1>Creator Dashboard</h1>

      {youtubeStatus?.connected ? (
        <div>
          <p>✅ YouTube Connected</p>
          <p>Channel ID: {youtubeStatus.channelId}</p>
          <button onClick={handleSyncVideos}>Sync Videos</button>
          <button onClick={handleDisconnectYouTube}>Disconnect</button>
        </div>
      ) : (
        <div>
          <p>❌ YouTube Not Connected</p>
          <button
            onClick={handleConnectYouTube}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect YouTube'}
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Handle Video Syncing (Optional)

```typescript
// Function to manually sync videos after connection
const handleSyncVideos = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/youtube/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to sync videos");
    }

    const data = await response.json();
    console.log("Videos synced:", data);
    alert(
      `Synced ${data.videosCount} videos (${data.newVideosCount} new, ${data.updatedVideosCount} updated)`
    );

    // Refresh video list
    loadVideos();
  } catch (error) {
    console.error("Error syncing videos:", error);
    alert("Failed to sync videos");
  }
};

// Function to get all videos
const loadVideos = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/youtube/videos`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Videos:", data.videos);
      // Update your state with videos
    }
  } catch (error) {
    console.error("Error loading videos:", error);
  }
};
```

### Step 4: Handle Disconnection

```typescript
const handleDisconnectYouTube = async () => {
  if (!confirm("Are you sure you want to disconnect YouTube?")) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/youtube/disconnect`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to disconnect YouTube");
    }

    alert("YouTube disconnected successfully");

    // Refresh status
    checkYouTubeStatus();

    // Clear videos from UI
    setVideos([]);
  } catch (error) {
    console.error("Error disconnecting YouTube:", error);
    alert("Failed to disconnect YouTube");
  }
};
```

## Complete React Component Example

```typescript
// components/YouTubeConnection.tsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

interface YouTubeStatus {
  connected: boolean;
  channelId?: string;
  lastSyncAt?: string;
}

export function YouTubeConnection() {
  const [status, setStatus] = useState<YouTubeStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const token = localStorage.getItem('accessToken');
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  // Check connection status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const youtube = searchParams.get('youtube');

    if (youtube === 'connected') {
      const message = searchParams.get('message');
      alert(`✅ ${decodeURIComponent(message || 'YouTube connected successfully')}`);
      setSearchParams({});
      checkStatus(); // Refresh status
    } else if (youtube === 'error') {
      const reason = searchParams.get('reason');
      alert(`❌ Connection failed: ${reason || 'Unknown error'}`);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const checkStatus = async () => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/youtube/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const handleConnect = async () => {
    if (!token) {
      alert('Please login first');
      return;
    }

    setIsConnecting(true);

    try {
      const res = await fetch(`${API_URL}/api/youtube/auth-url`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const { authUrl } = await res.json();
      window.location.href = authUrl; // Redirect to Google OAuth

      // Note: User will be redirected back to frontend via callback
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!token) return;

    setSyncing(true);

    try {
      const res = await fetch(`${API_URL}/api/youtube/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Sync failed');
      }

      const data = await res.json();
      alert(`✅ Synced ${data.videosCount} videos (${data.newVideosCount} new)`);
      checkStatus();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!token || !confirm('Disconnect YouTube?')) return;

    try {
      const res = await fetch(`${API_URL}/api/youtube/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        alert('YouTube disconnected');
        checkStatus();
      }
    } catch (error) {
      alert('Failed to disconnect');
    }
  };

  return (
    <div className="youtube-connection">
      <h2>YouTube Connection</h2>

      {status?.connected ? (
        <div className="connected">
          <p>✅ Connected</p>
          <p>Channel: {status.channelId}</p>
          <button onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Videos'}
          </button>
          <button onClick={handleDisconnect}>Disconnect</button>
        </div>
      ) : (
        <div className="not-connected">
          <p>❌ Not Connected</p>
          <button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect YouTube'}
          </button>
        </div>
      )}
    </div>
  );
}
```

## Error Handling

### Common Errors and Solutions

1. **"User not authenticated"**

   - **Cause**: Missing or invalid JWT token
   - **Solution**: Ensure user is logged in and token is valid

2. **"Forbidden resource"**

   - **Cause**: User doesn't have CREATOR or ADMIN role
   - **Solution**: Check user role and upgrade if needed

3. **"Failed to exchange authorization code"**

   - **Cause**: Missing `YOUTUBE_CLIENT_SECRET` or wrong redirect URI
   - **Solution**: Check backend environment variables

4. **"Not allowed by CORS"**

   - **Cause**: Frontend URL not in allowed origins
   - **Solution**: Add frontend URL to backend CORS configuration

5. **"YouTube client ID not configured"**
   - **Cause**: Missing `YOUTUBE_CLIENT_ID` in backend
   - **Solution**: Set environment variable in backend `.env`

## Testing the Connection

### Manual Testing Steps

1. **Start Backend**: Ensure server is running on port 3000
2. **Login**: Authenticate and get JWT token
3. **Check Role**: User must have CREATOR or ADMIN role
4. **Call Auth URL**: `GET /api/youtube/auth-url` with Bearer token
5. **Redirect**: User should be redirected to Google OAuth
6. **Authorize**: User grants permissions on Google
7. **Callback**: Backend processes callback and redirects to frontend
8. **Verify**: Check connection status via `GET /api/youtube/status`
9. **Sync**: Manually trigger sync via `POST /api/youtube/sync`
10. **View Videos**: Fetch videos via `GET /api/youtube/videos`

## Important Notes

1. **Automatic Sync**: Videos are automatically synced after successful connection
2. **Pagination**: Backend handles pagination automatically (fetches all videos)
3. **Token Refresh**: Backend automatically refreshes expired tokens
4. **Unlisted Videos**: The implementation fetches ALL videos including unlisted ones
5. **Redirect URI**: Must match exactly in Google Cloud Console and backend `.env`

## Security Considerations

1. **Never expose** `YOUTUBE_CLIENT_SECRET` in frontend code
2. **Validate tokens** on every request
3. **Handle errors** gracefully without exposing sensitive information
4. **Clean URL params** after processing OAuth callback
5. **Store tokens securely** (consider using httpOnly cookies instead of localStorage)

## API Endpoints Summary

| Endpoint                  | Method | Auth | Purpose                            |
| ------------------------- | ------ | ---- | ---------------------------------- |
| `/api/youtube/auth-url`   | GET    | ✅   | Get OAuth URL to start connection  |
| `/api/youtube/callback`   | GET    | ❌   | OAuth callback (handled by Google) |
| `/api/youtube/status`     | GET    | ✅   | Check connection status            |
| `/api/youtube/sync`       | POST   | ✅   | Manually sync videos               |
| `/api/youtube/videos`     | GET    | ✅   | Get all user's videos              |
| `/api/youtube/unlisted`   | GET    | ✅   | Get unlisted videos only           |
| `/api/youtube/disconnect` | DELETE | ✅   | Disconnect YouTube account         |

## Example cURL Commands

```bash
# Get auth URL
curl -X GET http://localhost:3000/api/youtube/auth-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check status
curl -X GET http://localhost:3000/api/youtube/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Sync videos
curl -X POST http://localhost:3000/api/youtube/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get all videos
curl -X GET http://localhost:3000/api/youtube/videos \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Frontend Environment Variables

```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_FRONTEND_URL=http://localhost:5179
```

This guide should help you successfully implement YouTube connection in your frontend! 🚀
