# Frontend Integration Plan - Creator Pool Platform

## Overview

This document outlines the complete frontend integration plan for the Creator Pool platform, focusing on the new YouTube channel synchronization features and the complete creator-to-predictor workflow.

## 🎯 Core Features to Implement

### 1. **YouTube Channel Integration**

- OAuth 2.0 authentication flow
- Channel synchronization
- Unlisted video discovery
- Real-time video status tracking

### 2. **Creator Dashboard**

- Channel connection management
- Video library with status indicators
- Pool creation from unlisted videos

### 3. **Predictor Interface**

- Active pools browsing
- Prediction placement
- Real-time odds tracking
- Portfolio management

### 4. **Real-time Updates**

- WebSocket integration for live data
- Pool status changes
- Odds updates
- Video metrics tracking

---

## 📋 Phase 1: React Router v7 Setup & Authentication

### 1.1 React Router v7 Project Setup

#### Initialize React Router v7 Project

```bash
# Create new React Router v7 project
npx create-react-router@latest creator-pool-frontend
cd creator-pool-frontend

# Install additional dependencies
npm install axios socket.io-client @stripe/stripe-js chart.js react-chartjs-2
```

#### Project Structure

```
app/
├── root.tsx                 # Root layout with providers
├── routes.ts               # Route configuration
├── +types/                 # Auto-generated types
├── routes/
│   ├── home.tsx           # Landing page
│   ├── login.tsx          # Login form
│   ├── register.tsx       # Registration form
│   ├── creator-layout.tsx # Creator layout with navigation
│   ├── creator-dashboard.tsx
│   ├── creator-youtube.tsx
│   ├── creator-videos.tsx
│   ├── creator-pools.tsx
│   ├── predictor-layout.tsx # Predictor layout
│   ├── predictor-dashboard.tsx
│   ├── predictor-pools.tsx
│   ├── pool-details.tsx
│   └── pool-predict.tsx
├── services/              # API services
├── components/           # Reusable components
├── providers/            # Context providers
└── styles/              # Global styles
```

#### Authentication Context Provider

```typescript
// app/providers/auth-provider.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { AuthService } from "../services/auth.service";

interface User {
  id: string;
  email: string;
  name: string;
  role: "creator" | "predictor" | "admin";
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authService = new AuthService();

  useEffect(() => {
    // Check for existing token on mount
    const token = authService.getAccessToken();
    if (token) {
      // Validate token and get user info
      authService.getProfile().then(setUser).catch(() => {
        authService.logout();
      }).finally(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login({ email, password });
    authService.setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

#### Protected Route Component

```typescript
// app/components/protected-route.tsx
import { Navigate } from "react-router";
import { useAuth } from "../providers/auth-provider";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "creator" | "predictor" | "admin";
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole && user.role !== "admin") {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
```

## 📋 Phase 2: Authentication & User Management

### 2.1 User Registration & Login

```typescript
// API Endpoints
POST / auth / register;
POST / auth / login;
POST / auth / refresh;
POST / auth / logout;
GET / auth / profile;
PUT / auth / profile;
```

**Frontend Implementation:**

```typescript
// services/auth.service.ts
export class AuthService {
  async register(userData: RegisterDto): Promise<AuthResponse> {
    const response = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    return response.json();
  }

  async login(credentials: LoginDto): Promise<AuthResponse> {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    return response.json();
  }

  // Token management
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }

  getAccessToken(): string | null {
    return localStorage.getItem("accessToken");
  }

  // Auto-refresh token logic
  async refreshToken(): Promise<string> {
    const refreshToken = localStorage.getItem("refreshToken");
    const response = await fetch("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await response.json();
    this.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  }
}
```

**React Components:**

```typescript
// components/auth/LoginForm.tsx
export const LoginForm: React.FC = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(credentials);
      // Redirect to dashboard
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={credentials.email}
        onChange={(e) => setCredentials({...credentials, email: e.target.value})}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={credentials.password}
        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
        placeholder="Password"
        required
      />
      <button type="submit">Login</button>
    </form>
  );
};
```

---

## 📋 Phase 3: YouTube Channel Integration

### 3.1 YouTube OAuth Flow with React Router v7

```typescript
// API Endpoints
GET / youtube / auth - url;
POST / youtube / callback;
GET / youtube / status;
DELETE / youtube / disconnect;
```

**Frontend Implementation:**

```typescript
// services/youtube.service.ts
export class YouTubeService {
  private baseUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";

  async getAuthUrl(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/youtube/auth-url`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
    const data = await response.json();
    return data.authUrl;
  }

  async checkConnectionStatus(): Promise<ConnectionStatus> {
    const response = await fetch(`${this.baseUrl}/youtube/status`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
    return response.json();
  }

  async disconnectChannel(): Promise<void> {
    await fetch(`${this.baseUrl}/youtube/disconnect`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  private getToken(): string {
    return localStorage.getItem("accessToken") || "";
  }
}
```

#### YouTube Integration Route (`routes/creator-youtube.tsx`)

```typescript
import type { Route } from "./+types/creator-youtube";
import { Form, useLoaderData, useSearchParams } from "react-router";
import { YouTubeService } from "../services/youtube.service";

export async function loader({ context }: Route.LoaderArgs) {
  const youtubeService = new YouTubeService();
  const connectionStatus = await youtubeService.checkConnectionStatus();
  return { connectionStatus };
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const action = formData.get("action") as string;
  const youtubeService = new YouTubeService();

  if (action === "connect") {
    const authUrl = await youtubeService.getAuthUrl();
    return redirect(authUrl);
  } else if (action === "disconnect") {
    await youtubeService.disconnectChannel();
    return redirect("/creator/youtube");
  }

  return null;
}

export default function CreatorYouTube() {
  const { connectionStatus } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const connected = searchParams.get("connected") === "true";
  const error = searchParams.get("error") === "true";

  return (
    <div className="creator-youtube">
      <h1>YouTube Integration</h1>

      {connected && (
        <div className="alert success">
          ✅ YouTube channel connected successfully!
        </div>
      )}

      {error && (
        <div className="alert error">
          ❌ Failed to connect YouTube channel. Please try again.
        </div>
      )}

      <div className="connection-status">
        {connectionStatus.connected ? (
          <div className="connected-state">
            <h3>✅ YouTube Connected</h3>
            <p>Channel: {connectionStatus.channelId}</p>
            <p>Last sync: {new Date(connectionStatus.lastSyncAt).toLocaleString()}</p>

            <div className="actions">
              <Form method="post">
                <input type="hidden" name="action" value="sync" />
                <button type="submit" className="btn-primary">
                  Sync Channel
                </button>
              </Form>

              <Form method="post">
                <input type="hidden" name="action" value="disconnect" />
                <button type="submit" className="btn-danger">
                  Disconnect
                </button>
              </Form>
            </div>
          </div>
        ) : (
          <div className="disconnected-state">
            <h3>❌ YouTube Not Connected</h3>
            <p>Connect your YouTube channel to start creating pools from your unlisted videos.</p>

            <Form method="post">
              <input type="hidden" name="action" value="connect" />
              <button type="submit" className="btn-primary">
                Connect YouTube Channel
              </button>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
```

**React Components:**

```typescript
// components/youtube/YouTubeConnection.tsx
export const YouTubeConnection: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const youtubeService = new YouTubeService();

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const status = await youtubeService.checkConnectionStatus();
      setConnectionStatus(status);
    } catch (error) {
      console.error('Failed to check connection status:', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const authUrl = await youtubeService.getAuthUrl();
      // Redirect to YouTube OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await youtubeService.disconnectChannel();
      setConnectionStatus({ connected: false });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  if (connectionStatus?.connected) {
    return (
      <div className="youtube-connected">
        <div className="status-indicator connected">
          <span>✅ YouTube Connected</span>
          <span>Channel: {connectionStatus.channelId}</span>
        </div>
        <button onClick={handleDisconnect} className="btn-danger">
          Disconnect YouTube
        </button>
      </div>
    );
  }

  return (
    <div className="youtube-connection">
      <div className="status-indicator disconnected">
        <span>❌ YouTube Not Connected</span>
      </div>
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="btn-primary"
      >
        {isConnecting ? 'Connecting...' : 'Connect YouTube Channel'}
      </button>
    </div>
  );
};
```

### 3.2 Channel Synchronization

```typescript
// API Endpoints
POST / youtube / sync;
GET / youtube / unlisted;
```

**Frontend Implementation:**

```typescript
// components/youtube/ChannelSync.tsx
export const ChannelSync: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [unlistedVideos, setUnlistedVideos] = useState<Video[]>([]);

  const syncChannel = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/youtube/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const result = await response.json();
      setSyncResult(result);

      // Refresh unlisted videos
      await loadUnlistedVideos();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadUnlistedVideos = async () => {
    try {
      const response = await fetch('/youtube/unlisted', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const videos = await response.json();
      setUnlistedVideos(videos);
    } catch (error) {
      console.error('Failed to load unlisted videos:', error);
    }
  };

  useEffect(() => {
    loadUnlistedVideos();
  }, []);

  return (
    <div className="channel-sync">
      <div className="sync-controls">
        <button
          onClick={syncChannel}
          disabled={isSyncing}
          className="btn-primary"
        >
          {isSyncing ? 'Syncing...' : 'Sync Channel'}
        </button>
      </div>

      {syncResult && (
        <div className="sync-result">
          <h3>Sync Complete!</h3>
          <div className="stats">
            <div className="stat">
              <span className="label">Total Videos:</span>
              <span className="value">{syncResult.videosCount}</span>
            </div>
            <div className="stat">
              <span className="label">New Videos:</span>
              <span className="value">{syncResult.newVideosCount}</span>
            </div>
            <div className="stat">
              <span className="label">Updated Videos:</span>
              <span className="value">{syncResult.updatedVideosCount}</span>
            </div>
            <div className="stat">
              <span className="label">Unlisted Videos:</span>
              <span className="value">{syncResult.unlistedVideosCount}</span>
            </div>
          </div>
        </div>
      )}

      <div className="unlisted-videos">
        <h3>Unlisted Videos Ready for Pools</h3>
        <div className="video-grid">
          {unlistedVideos.map(video => (
            <UnlistedVideoCard
              key={video.id}
              video={video}
              onCreatePool={() => createPool(video.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

## 📋 Phase 4: Creator Dashboard

### 4.1 Video Management

```typescript
// components/creator/VideoLibrary.tsx
export const VideoLibrary: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [filter, setFilter] = useState<'all' | 'unlisted' | 'public' | 'tracking'>('all');

  const loadVideos = async () => {
    try {
      const response = await fetch(`/videos/creator/${userId}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const videos = await response.json();
      setVideos(videos);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const filteredVideos = videos.filter(video => {
    switch (filter) {
      case 'unlisted':
        return video.status === 'unlisted';
      case 'public':
        return video.status === 'public';
      case 'tracking':
        return video.status === 'public' && video.hasActivePool;
      default:
        return true;
    }
  });

  return (
    <div className="video-library">
      <div className="filters">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All Videos
        </button>
        <button
          className={filter === 'unlisted' ? 'active' : ''}
          onClick={() => setFilter('unlisted')}
        >
          Unlisted ({videos.filter(v => v.status === 'unlisted').length})
        </button>
        <button
          className={filter === 'public' ? 'active' : ''}
          onClick={() => setFilter('public')}
        >
          Public ({videos.filter(v => v.status === 'public').length})
        </button>
        <button
          className={filter === 'tracking' ? 'active' : ''}
          onClick={() => setFilter('tracking')}
        >
          Tracking ({videos.filter(v => v.status === 'public' && v.hasActivePool).length})
        </button>
      </div>

      <div className="video-grid">
        {filteredVideos.map(video => (
          <VideoCard
            key={video.id}
            video={video}
            onAction={handleVideoAction}
          />
        ))}
      </div>
    </div>
  );
};
```

### 4.2 Pool Creation

```typescript
// components/creator/PoolCreation.tsx
export const PoolCreation: React.FC<{ video: Video }> = ({ video }) => {
  const [poolData, setPoolData] = useState({
    question: '',
    targetViews: 10000,
    duration: 7,
    predictionWindow: 10,
    creatorPledge: 0
  });

  const createPool = async () => {
    try {
      const response = await fetch('/pools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          videoId: video.id,
          ...poolData
        })
      });

      const pool = await response.json();
      // Redirect to pool management
      navigate(`/creator/pools/${pool.id}`);
    } catch (error) {
      console.error('Failed to create pool:', error);
    }
  };

  return (
    <div className="pool-creation">
      <div className="video-preview">
        <img src={video.thumbnail} alt={video.title} />
        <h3>{video.title}</h3>
        <p>Status: {video.status}</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); createPool(); }}>
        <div className="form-group">
          <label>Prediction Question</label>
          <input
            type="text"
            value={poolData.question}
            onChange={(e) => setPoolData({...poolData, question: e.target.value})}
            placeholder="Will this video reach 50K views?"
            required
          />
        </div>

        <div className="form-group">
          <label>Target Views</label>
          <input
            type="number"
            value={poolData.targetViews}
            onChange={(e) => setPoolData({...poolData, targetViews: parseInt(e.target.value)})}
            min="1000"
            required
          />
        </div>

        <div className="form-group">
          <label>Tracking Duration (days)</label>
          <select
            value={poolData.duration}
            onChange={(e) => setPoolData({...poolData, duration: parseInt(e.target.value)})}
          >
            <option value={1}>1 Day</option>
            <option value={3}>3 Days</option>
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
        </div>

        <div className="form-group">
          <label>Prediction Window (minutes)</label>
          <input
            type="number"
            value={poolData.predictionWindow}
            onChange={(e) => setPoolData({...poolData, predictionWindow: parseInt(e.target.value)})}
            min="5"
            max="60"
            required
          />
        </div>

        <div className="form-group">
          <label>Creator Pledge ($)</label>
          <input
            type="number"
            value={poolData.creatorPledge}
            onChange={(e) => setPoolData({...poolData, creatorPledge: parseFloat(e.target.value)})}
            min="0"
            step="0.01"
          />
        </div>

        <button type="submit" className="btn-primary">
          Create Pool
        </button>
      </form>
    </div>
  );
};
```

---

## 📋 Phase 5: Predictor Interface

### 5.1 Pool Browsing

```typescript
// components/predictor/PoolBrowser.tsx
export const PoolBrowser: React.FC = () => {
  const [pools, setPools] = useState<Pool[]>([]);
  const [filter, setFilter] = useState<'active' | 'trending' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const loadPools = async () => {
    try {
      const endpoint = filter === 'active' ? '/pools/active' :
                      filter === 'trending' ? '/pools/trending' : '/pools';

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const pools = await response.json();
      setPools(pools);
    } catch (error) {
      console.error('Failed to load pools:', error);
    }
  };

  useEffect(() => {
    loadPools();
  }, [filter]);

  const filteredPools = pools.filter(pool =>
    pool.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pool.video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pool-browser">
      <div className="search-bar">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search pools..."
        />
      </div>

      <div className="filters">
        <button
          className={filter === 'active' ? 'active' : ''}
          onClick={() => setFilter('active')}
        >
          Active Pools
        </button>
        <button
          className={filter === 'trending' ? 'active' : ''}
          onClick={() => setFilter('trending')}
        >
          Trending
        </button>
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All Pools
        </button>
      </div>

      <div className="pool-grid">
        {filteredPools.map(pool => (
          <PoolCard
            key={pool.id}
            pool={pool}
            onPredict={() => navigate(`/predictor/pools/${pool.id}`)}
          />
        ))}
      </div>
    </div>
  );
};
```

### 5.2 Prediction Interface

```typescript
// components/predictor/PredictionInterface.tsx
export const PredictionInterface: React.FC<{ poolId: string }> = ({ poolId }) => {
  const [pool, setPool] = useState<Pool | null>(null);
  const [prediction, setPrediction] = useState({
    choice: 'yes' as 'yes' | 'no',
    stake: 0
  });
  const [userBalance, setUserBalance] = useState(0);

  const loadPool = async () => {
    try {
      const response = await fetch(`/pools/${poolId}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const pool = await response.json();
      setPool(pool);
    } catch (error) {
      console.error('Failed to load pool:', error);
    }
  };

  const loadUserBalance = async () => {
    try {
      const response = await fetch('/wallet/balance', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const balance = await response.json();
      setUserBalance(balance.balance);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const placePrediction = async () => {
    try {
      const response = await fetch('/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          poolId,
          ...prediction
        })
      });

      const result = await response.json();
      // Show success message
      // Refresh pool data
      await loadPool();
      await loadUserBalance();
    } catch (error) {
      console.error('Failed to place prediction:', error);
    }
  };

  useEffect(() => {
    loadPool();
    loadUserBalance();
  }, [poolId]);

  if (!pool) return <div>Loading...</div>;

  const potentialPayout = prediction.stake * (1 + (prediction.choice === 'yes' ? pool.yesOdds : pool.noOdds));

  return (
    <div className="prediction-interface">
      <div className="pool-info">
        <div className="video-preview">
          <img src={pool.video.thumbnail} alt={pool.video.title} />
          <h3>{pool.video.title}</h3>
        </div>

        <div className="pool-details">
          <h2>{pool.question}</h2>
          <div className="target-info">
            <span>Target: {pool.targetViews.toLocaleString()} views</span>
            <span>Current: {pool.currentViews.toLocaleString()} views</span>
            <span>Progress: {((pool.currentViews / pool.targetViews) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="prediction-form">
        <div className="odds-display">
          <div className="odds-card yes">
            <h3>YES</h3>
            <div className="odds">{pool.yesOdds.toFixed(2)}x</div>
            <div className="stake">${pool.yesStake.toFixed(2)}</div>
          </div>
          <div className="odds-card no">
            <h3>NO</h3>
            <div className="odds">{pool.noOdds.toFixed(2)}x</div>
            <div className="stake">${pool.noStake.toFixed(2)}</div>
          </div>
        </div>

        <div className="prediction-controls">
          <div className="choice-selector">
            <button
              className={prediction.choice === 'yes' ? 'active' : ''}
              onClick={() => setPrediction({...prediction, choice: 'yes'})}
            >
              YES
            </button>
            <button
              className={prediction.choice === 'no' ? 'active' : ''}
              onClick={() => setPrediction({...prediction, choice: 'no'})}
            >
              NO
            </button>
          </div>

          <div className="stake-input">
            <label>Stake Amount ($)</label>
            <input
              type="number"
              value={prediction.stake}
              onChange={(e) => setPrediction({...prediction, stake: parseFloat(e.target.value)})}
              min="1"
              max={userBalance}
              step="0.01"
            />
            <div className="balance-info">
              Available: ${userBalance.toFixed(2)}
            </div>
          </div>

          <div className="payout-preview">
            <div className="potential-payout">
              Potential Payout: ${potentialPayout.toFixed(2)}
            </div>
            <div className="profit">
              Profit: ${(potentialPayout - prediction.stake).toFixed(2)}
            </div>
          </div>

          <button
            onClick={placePrediction}
            disabled={prediction.stake <= 0 || prediction.stake > userBalance}
            className="btn-primary"
          >
            Place Prediction
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 📋 Phase 6: Real-time Updates

### 6.1 WebSocket Integration

```typescript
// services/websocket.service.ts
export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string): void {
    const wsUrl = `${process.env.REACT_APP_WS_URL || "ws://localhost:3000"}?token=${token}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log("WebSocket connected");
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.socket.onclose = () => {
      console.log("WebSocket disconnected");
      this.attemptReconnect(token);
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(
          `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.connect(token);
      }, 5000 * this.reconnectAttempts);
    }
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case "poolUpdate":
        this.emit("poolUpdate", data.payload);
        break;
      case "newPrediction":
        this.emit("newPrediction", data.payload);
        break;
      case "oddsUpdate":
        this.emit("oddsUpdate", data.payload);
        break;
      case "videoMetricsUpdate":
        this.emit("videoMetricsUpdate", data.payload);
        break;
    }
  }

  joinPool(poolId: string): void {
    this.send({
      type: "joinPool",
      payload: { poolId },
    });
  }

  leavePool(poolId: string): void {
    this.send({
      type: "leavePool",
      payload: { poolId },
    });
  }

  private send(data: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  private emit(event: string, data: any): void {
    // Implement event emitter logic
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
```

### 6.2 Real-time Pool Updates

```typescript
// hooks/usePoolUpdates.ts
export const usePoolUpdates = (poolId: string) => {
  const [pool, setPool] = useState<Pool | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  useEffect(() => {
    const wsService = new WebSocketService();
    const token = localStorage.getItem("accessToken");

    if (token) {
      wsService.connect(token);
      wsService.joinPool(poolId);
    }

    const handlePoolUpdate = (event: CustomEvent) => {
      if (event.detail.poolId === poolId) {
        setPool(event.detail.pool);
      }
    };

    const handleNewPrediction = (event: CustomEvent) => {
      if (event.detail.poolId === poolId) {
        setPredictions((prev) => [...prev, event.detail.prediction]);
      }
    };

    const handleOddsUpdate = (event: CustomEvent) => {
      if (event.detail.poolId === poolId) {
        setPool((prev) =>
          prev
            ? {
                ...prev,
                yesOdds: event.detail.yesOdds,
                noOdds: event.detail.noOdds,
                yesStake: event.detail.yesStake,
                noStake: event.detail.noStake,
              }
            : null
        );
      }
    };

    window.addEventListener("poolUpdate", handlePoolUpdate as EventListener);
    window.addEventListener(
      "newPrediction",
      handleNewPrediction as EventListener
    );
    window.addEventListener("oddsUpdate", handleOddsUpdate as EventListener);

    return () => {
      wsService.leavePool(poolId);
      wsService.disconnect();
      window.removeEventListener(
        "poolUpdate",
        handlePoolUpdate as EventListener
      );
      window.removeEventListener(
        "newPrediction",
        handleNewPrediction as EventListener
      );
      window.removeEventListener(
        "oddsUpdate",
        handleOddsUpdate as EventListener
      );
    };
  }, [poolId]);

  return { pool, predictions };
};
```

---

## 📋 Phase 7: Wallet & Transactions

### 7.1 Wallet Management

```typescript
// components/wallet/WalletDashboard.tsx
export const WalletDashboard: React.FC = () => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isDepositing, setIsDepositing] = useState(false);

  const loadWalletData = async () => {
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        fetch('/wallet/balance', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch('/transactions', {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
      ]);

      const balanceData = await balanceRes.json();
      const transactionsData = await transactionsRes.json();

      setBalance(balanceData.balance);
      setTransactions(transactionsData.transactions);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    }
  };

  const deposit = async (amount: number, method: 'stripe' | 'paypal') => {
    try {
      const response = await fetch('/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ amount, paymentMethod: method })
      });

      const result = await response.json();

      if (method === 'stripe' && result.paymentIntent) {
        // Handle Stripe payment
        const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY!);
        await stripe.confirmCardPayment(result.paymentIntent.client_secret);
      } else if (method === 'paypal' && result.approvalUrl) {
        // Redirect to PayPal
        window.location.href = result.approvalUrl;
      }

      await loadWalletData();
    } catch (error) {
      console.error('Deposit failed:', error);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  return (
    <div className="wallet-dashboard">
      <div className="balance-card">
        <h2>Wallet Balance</h2>
        <div className="balance-amount">${balance.toFixed(2)}</div>
        <div className="balance-actions">
          <button onClick={() => setIsDepositing(true)} className="btn-primary">
            Add Funds
          </button>
          <button className="btn-secondary">Withdraw</button>
        </div>
      </div>

      <div className="transactions">
        <h3>Recent Transactions</h3>
        <div className="transaction-list">
          {transactions.map(transaction => (
            <TransactionItem key={transaction.id} transaction={transaction} />
          ))}
        </div>
      </div>

      {isDepositing && (
        <DepositModal
          onDeposit={deposit}
          onClose={() => setIsDepositing(false)}
        />
      )}
    </div>
  );
};
```

---

## 📋 Phase 8: Analytics & Reporting

### 8.1 Creator Analytics

```typescript
// components/analytics/CreatorAnalytics.tsx
export const CreatorAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/analytics/creator/me', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (!analytics) return <div>Loading analytics...</div>;

  return (
    <div className="creator-analytics">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Pools</h3>
          <div className="stat-value">{analytics.totalPools}</div>
        </div>
        <div className="stat-card">
          <h3>Total Participants</h3>
          <div className="stat-value">{analytics.totalParticipants}</div>
        </div>
        <div className="stat-card">
          <h3>Total Staked</h3>
          <div className="stat-value">${analytics.totalStaked.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <h3>Total Earned</h3>
          <div className="stat-value">${analytics.totalEarned.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <h3>Win Rate</h3>
          <div className="stat-value">{(analytics.winRate * 100).toFixed(1)}%</div>
        </div>
        <div className="stat-card">
          <h3>Avg Pool Size</h3>
          <div className="stat-value">${analytics.averagePoolSize.toFixed(2)}</div>
        </div>
      </div>

      <div className="charts">
        <div className="chart-container">
          <h3>Monthly Performance</h3>
          <MonthlyChart data={analytics.monthlyData} />
        </div>
        <div className="chart-container">
          <h3>Pool Performance</h3>
          <PoolPerformanceChart data={analytics.poolPerformance} />
        </div>
      </div>
    </div>
  );
};
```

---

## 📋 Phase 9: Mobile Responsiveness

### 9.1 Responsive Design

```css
/* styles/responsive.css */
@media (max-width: 768px) {
  .video-grid {
    grid-template-columns: 1fr;
  }

  .pool-grid {
    grid-template-columns: 1fr;
  }

  .prediction-interface {
    flex-direction: column;
  }

  .odds-display {
    flex-direction: column;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .filters {
    flex-wrap: wrap;
  }

  .filter button {
    flex: 1;
    min-width: 80px;
  }
}
```

---

## 📋 Phase 10: Testing Strategy

### 10.1 Unit Tests

```typescript
// __tests__/services/auth.service.test.ts
describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  it("should register a new user", async () => {
    const userData = {
      email: "test@example.com",
      name: "Test User",
      password: "password123",
      role: "creator",
    };

    const mockResponse = {
      user: { id: "1", ...userData },
      accessToken: "mock-token",
      refreshToken: "mock-refresh-token",
    };

    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await authService.register(userData);
    expect(result).toEqual(mockResponse);
  });
});
```

### 10.2 Integration Tests

```typescript
// __tests__/integration/youtube-integration.test.ts
describe("YouTube Integration", () => {
  it("should complete OAuth flow", async () => {
    // Test OAuth URL generation
    const authUrlResponse = await fetch("/youtube/auth-url", {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    expect(authUrlResponse.status).toBe(200);

    const { authUrl } = await authUrlResponse.json();
    expect(authUrl).toContain("accounts.google.com");
  });

  it("should sync channel videos", async () => {
    const syncResponse = await fetch("/youtube/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${validToken}` },
    });

    expect(syncResponse.status).toBe(200);
    const result = await syncResponse.json();
    expect(result.success).toBe(true);
    expect(result.videosCount).toBeGreaterThan(0);
  });
});
```

---

## 📋 Phase 11: Deployment & Environment Setup

### 11.1 Environment Variables

```bash
# .env
REACT_APP_API_URL=https://api.creatorpool.com
REACT_APP_WS_URL=wss://api.creatorpool.com
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
REACT_APP_PAYPAL_CLIENT_ID=your_paypal_client_id
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

### 11.2 React Router v7 Configuration

#### Route Configuration (`app/routes.ts`)

```typescript
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Public routes
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),

  // Creator routes
  route("creator", "routes/creator-layout.tsx", [
    index("routes/creator-dashboard.tsx"),
    route("videos", "routes/creator-videos.tsx"),
    route("pools", "routes/creator-pools.tsx"),
    route("analytics", "routes/creator-analytics.tsx"),
    route("youtube", "routes/creator-youtube.tsx"),
    route("wallet", "routes/creator-wallet.tsx"),
  ]),

  // Predictor routes
  route("predictor", "routes/predictor-layout.tsx", [
    index("routes/predictor-dashboard.tsx"),
    route("pools", "routes/predictor-pools.tsx"),
    route("predictions", "routes/predictor-predictions.tsx"),
    route("wallet", "routes/predictor-wallet.tsx"),
    route("leaderboard", "routes/predictor-leaderboard.tsx"),
  ]),

  // Pool-specific routes
  route("pools/:id", "routes/pool-details.tsx"),
  route("pools/:id/predict", "routes/pool-predict.tsx"),

  // API routes
  route("api/youtube/callback", "routes/api/youtube-callback.tsx"),
] satisfies RouteConfig;
```

#### Root Layout (`app/root.tsx`)

```typescript
import type { Route } from "./+types/root";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { AuthProvider } from "./providers/auth-provider";
import { WebSocketProvider } from "./providers/websocket-provider";

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
    { rel: "stylesheet", href: "/styles/globals.css" },
  ];
}

export function meta() {
  return [
    { title: "Creator Pool - Predict YouTube Video Performance" },
    { name: "description", content: "A prediction platform where fans predict YouTube video performance and creators earn rewards." },
  ];
}

export default function Root({ children }: Route.ComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <AuthProvider>
          <WebSocketProvider>
            <div id="root">
              <Outlet />
            </div>
          </WebSocketProvider>
        </AuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

#### Authentication Route (`routes/login.tsx`)

```typescript
import type { Route } from "./+types/login";
import { Form, redirect } from "react-router";
import { AuthService } from "../services/auth.service";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const authService = new AuthService();
    const result = await authService.login({ email, password });

    // Store tokens
    authService.setTokens(result.accessToken, result.refreshToken);

    // Redirect to appropriate dashboard based on role
    const redirectTo = result.user.role === 'creator' ? '/creator' : '/predictor';
    return redirect(redirectTo);
  } catch (error) {
    return { error: "Invalid credentials" };
  }
}

export default function Login() {
  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Welcome to Creator Pool</h1>
        <Form method="post" className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              name="email"
              id="email"
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              name="password"
              id="password"
              required
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" className="btn-primary">
            Sign In
          </button>
        </Form>
        <p className="signup-link">
          Don't have an account? <a href="/register">Sign up</a>
        </p>
      </div>
    </div>
  );
}
```

#### Creator Dashboard (`routes/creator-dashboard.tsx`)

```typescript
import type { Route } from "./+types/creator-dashboard";
import { Link, useLoaderData } from "react-router";
import { YouTubeService } from "../services/youtube.service";
import { PoolService } from "../services/pool.service";

export async function loader({ context }: Route.LoaderArgs) {
  const youtubeService = new YouTubeService();
  const poolService = new PoolService();

  const [connectionStatus, activePools, unlistedVideos] = await Promise.all([
    youtubeService.checkConnectionStatus(),
    poolService.getCreatorPools(context.user.id),
    youtubeService.getUnlistedVideos(context.user.id),
  ]);

  return {
    connectionStatus,
    activePools,
    unlistedVideos,
  };
}

export default function CreatorDashboard() {
  const { connectionStatus, activePools, unlistedVideos } = useLoaderData<typeof loader>();

  return (
    <div className="creator-dashboard">
      <div className="dashboard-header">
        <h1>Creator Dashboard</h1>
        <div className="quick-actions">
          <Link to="/creator/youtube" className="btn-primary">
            Manage YouTube
          </Link>
          <Link to="/creator/pools" className="btn-secondary">
            View Pools
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stats-card">
          <h3>YouTube Connection</h3>
          <div className={`status ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
            {connectionStatus.connected ? '✅ Connected' : '❌ Not Connected'}
          </div>
          {connectionStatus.connected && (
            <p>Channel: {connectionStatus.channelId}</p>
          )}
        </div>

        <div className="stats-card">
          <h3>Active Pools</h3>
          <div className="stat-number">{activePools.length}</div>
          <Link to="/creator/pools">View All</Link>
        </div>

        <div className="stats-card">
          <h3>Unlisted Videos</h3>
          <div className="stat-number">{unlistedVideos.length}</div>
          <Link to="/creator/videos">Manage Videos</Link>
        </div>
      </div>

      <div className="recent-activity">
        <h2>Recent Activity</h2>
        {activePools.length > 0 ? (
          <div className="activity-list">
            {activePools.slice(0, 5).map(pool => (
              <div key={pool.id} className="activity-item">
                <h4>{pool.question}</h4>
                <p>Status: {pool.status}</p>
                <p>Participants: {pool.participants}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>No recent activity. <Link to="/creator/youtube">Connect your YouTube channel</Link> to get started!</p>
        )}
      </div>
    </div>
  );
}
```

#### Pool Details Route (`routes/pool-details.tsx`)

```typescript
import type { Route } from "./+types/pool-details";
import { useLoaderData, useParams } from "react-router";
import { PoolService } from "../services/pool.service";
import { PredictionService } from "../services/prediction.service";

export async function loader({ params }: Route.LoaderArgs) {
  const poolService = new PoolService();
  const predictionService = new PredictionService();

  const [pool, predictions] = await Promise.all([
    poolService.getPoolById(params.id),
    predictionService.getPoolPredictions(params.id),
  ]);

  return { pool, predictions };
}

export default function PoolDetails() {
  const { pool, predictions } = useLoaderData<typeof loader>();

  return (
    <div className="pool-details">
      <div className="pool-header">
        <img src={pool.video.thumbnail} alt={pool.video.title} />
        <div className="pool-info">
          <h1>{pool.question}</h1>
          <p className="video-title">{pool.video.title}</p>
          <div className="pool-stats">
            <span>Target: {pool.targetViews.toLocaleString()} views</span>
            <span>Current: {pool.currentViews.toLocaleString()} views</span>
            <span>Progress: {((pool.currentViews / pool.targetViews) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="pool-content">
        <div className="odds-section">
          <div className="odds-card yes">
            <h3>YES</h3>
            <div className="odds">{pool.yesOdds.toFixed(2)}x</div>
            <div className="stake">${pool.yesStake.toFixed(2)}</div>
          </div>
          <div className="odds-card no">
            <h3>NO</h3>
            <div className="odds">{pool.noOdds.toFixed(2)}x</div>
            <div className="stake">${pool.noStake.toFixed(2)}</div>
          </div>
        </div>

        <div className="predictions-section">
          <h3>Recent Predictions</h3>
          <div className="predictions-list">
            {predictions.slice(0, 10).map(prediction => (
              <div key={prediction.id} className="prediction-item">
                <span className="choice">{prediction.choice.toUpperCase()}</span>
                <span className="stake">${prediction.stake.toFixed(2)}</span>
                <span className="user">{prediction.predictor.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 11.3 Build Configuration

```json
// package.json
{
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-serve ./build/server/index.js",
    "typecheck": "react-router typegen && tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router": "^7.0.0",
    "@react-router/dev": "^7.0.0",
    "@react-router/node": "^7.0.0",
    "@react-router/serve": "^7.0.0",
    "axios": "^1.3.0",
    "socket.io-client": "^4.6.0",
    "@stripe/stripe-js": "^1.28.0",
    "chart.js": "^4.2.0",
    "react-chartjs-2": "^5.2.0"
  }
}
```

#### React Router v7 Configuration (`react-router.config.ts`)

```typescript
import type { Config } from "@react-router/dev/config";

export default {
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
  },
  serverModuleFormat: "esm",
  serverPlatform: "node",
  serverDependenciesToBundle: ["socket.io-client", "@stripe/stripe-js"],
  publicPath: "/build/",
  serverBuildPath: "build/server/index.js",
  serverConditions: ["workerd", "worker", "browser"],
  serverMainFields: ["browser", "module", "main"],
  serverMinify: true,
  serverNodeBuiltinsPolyfill: {
    modules: {
      crypto: true,
      fs: true,
      path: true,
    },
  },
} satisfies Config;
```

---

## 🚀 Implementation Timeline

### Week 1-2: Foundation

- [ ] Authentication system
- [ ] User management
- [ ] Basic routing
- [ ] API service layer

### Week 3-4: YouTube Integration

- [ ] OAuth flow implementation
- [ ] Channel synchronization
- [ ] Video management interface
- [ ] Unlisted video discovery

### Week 5-6: Creator Features

- [ ] Creator dashboard
- [ ] Pool creation interface
- [ ] Video library management
- [ ] Analytics dashboard

### Week 7-8: Predictor Features

- [ ] Pool browsing interface
- [ ] Prediction placement
- [ ] Real-time odds tracking
- [ ] Portfolio management

### Week 9-10: Real-time & Polish

- [ ] WebSocket integration
- [ ] Real-time updates
- [ ] Mobile responsiveness
- [ ] Testing & optimization

---

## 🎯 Success Metrics

### User Engagement

- Channel connection rate: >80%
- Pool creation rate: >60% of connected creators
- Prediction participation: >40% of active users
- Session duration: >15 minutes average

### Technical Performance

- Page load time: <3 seconds
- API response time: <500ms
- WebSocket connection stability: >99%
- Mobile responsiveness: 100% compatibility

### Business Metrics

- Creator earnings: Track total creator payouts
- Platform revenue: Track fee collection
- User retention: >70% monthly active users
- Pool success rate: >60% accurate predictions

---

## 🎯 React Router v7 Benefits for Creator Pool

### **Key Advantages:**

1. **Type-Safe Routing**: Automatic type generation for all routes, loaders, and actions
2. **Server-Side Rendering**: Built-in SSR support for better SEO and performance
3. **Progressive Enhancement**: Forms work without JavaScript, enhanced with JS
4. **Data Loading**: Built-in data loading patterns with loaders and actions
5. **Real-time Updates**: Seamless integration with WebSocket for live data
6. **File-based Routing**: Clear project structure with explicit route configuration

### **Perfect for Creator Pool Because:**

- **YouTube OAuth Flow**: Server-side OAuth handling with automatic redirects
- **Real-time Pool Updates**: WebSocket integration for live odds and predictions
- **Role-based Access**: Protected routes with automatic role checking
- **Data Synchronization**: Automatic data loading and caching for video metrics
- **Mobile-first**: Responsive design with React Router v7's mobile optimizations

---

This comprehensive frontend integration plan provides a complete roadmap for implementing the Creator Pool platform with React Router v7 and all the YouTube channel synchronization features we've built in the backend. The plan is structured in phases to allow for iterative development and testing, leveraging React Router v7's powerful features for optimal user experience.
