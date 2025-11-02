# YouTube Connection Flow - Beginner's Guide

## 🎯 What Does This Do?

This system allows users (creators) to connect their YouTube channel to the Creator Pool platform. Once connected, the system can:

- Fetch all videos from their channel
- Track video statistics
- Create prediction pools on videos

Think of it like connecting your Google account to a third-party app - you grant permission, and the app can access your YouTube data.

---

## 📋 The Big Picture Flow

Here's what happens when a user wants to connect their YouTube account:

```
1. User clicks "Connect YouTube" in frontend
   ↓
2. Frontend calls: GET /api/youtube/auth-url
   ↓
3. Backend generates a special Google OAuth URL
   ↓
4. User is redirected to Google's login page
   ↓
5. User authorizes the app on Google
   ↓
6. Google redirects back to: GET /api/youtube/callback?code=XXX&state=YYY
   ↓
7. Backend exchanges code for access tokens
   ↓
8. Backend fetches user's YouTube channel info
   ↓
9. Backend saves credentials to database
   ↓
10. Backend automatically syncs all videos
   ↓
11. Backend redirects user back to frontend (success!)
```

---

## 🧩 All The Pieces (Components)

### 1. **Database Entity: User** (`src/entities/user.entity.ts`)

**What it does:** Defines what YouTube data we store about each user in the database.

```typescript
@Entity("users")
export class User {
  // ... other fields ...

  // YouTube Integration fields
  @Column({ type: "varchar", nullable: true })
  youtubeChannelId: string; // Their YouTube channel ID

  @Column({ type: "varchar", select: false, nullable: true })
  youtubeAccessToken: string; // Token to access YouTube API

  @Column({ type: "varchar", select: false, nullable: true })
  youtubeRefreshToken: string; // Token to get new access tokens when old ones expire

  @Column({ type: "timestamp", nullable: true })
  youtubeTokenExpiresAt: Date; // When the access token expires
}
```

**Why it's important:** When we save YouTube credentials, they go into these fields. The `select: false` on tokens means they're hidden by default (security).

---

### 2. **Module: YouTubeModule** (`src/youtube/youtube.module.ts`)

**What it does:** Tells NestJS which pieces belong together for YouTube functionality.

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Video]), // Give access to User and Video database tables
  ],
  controllers: [YouTubeController], // The endpoints (routes)
  providers: [YouTubeService], // The business logic
  exports: [YouTubeService], // Make service available to other modules
})
export class YouTubeModule {}
```

**Why it's important:** NestJS uses modules to organize code. This module says:

- "These controllers and services work together"
- "Give them access to User and Video database tables"
- "Make YouTubeService available to other parts of the app"

---

### 3. **Controller: YouTubeController** (`src/youtube/youtube.controller.ts`)

**What it does:** Defines the HTTP endpoints (routes) that frontend calls.

Think of it like a **receptionist** - it receives requests, validates them, and calls the appropriate service.

#### Endpoint 1: Get OAuth URL

```typescript
@Get("auth-url")  // This becomes: GET /api/youtube/auth-url
@UseGuards(AuthGuard("jwt"), RolesGuard)  // Requires user to be logged in
@Roles(UserRole.CREATOR, UserRole.ADMIN)  // Only creators/admins can use this
async getAuthUrl(@CurrentUser() user: User) {
  // Get the authenticated user from the JWT token

  // Call the service to generate the OAuth URL
  const authUrl = this.youtubeService.generateAuthUrl(user.id);

  // Return it to frontend
  return { authUrl, success: true };
}
```

**Flow:**

- Frontend sends: `GET /api/youtube/auth-url` with JWT token
- Controller checks: User is logged in? ✅ User has CREATOR/ADMIN role? ✅
- Controller calls: `youtubeService.generateAuthUrl(user.id)`
- Controller returns: `{ authUrl: "https://accounts.google.com/...", success: true }`

#### Endpoint 2: OAuth Callback

```typescript
@Get("callback")  // This becomes: GET /api/youtube/callback
async handleCallback(
  @Query("code") code: string,    // Google gives us this
  @Query("state") state: string,  // We send this to get user ID back
  @Query("error") error: string,  // If user cancels, Google sends error
  @Res() res: Response            // To redirect back to frontend
) {
  // If user cancelled authorization
  if (error) {
    return res.redirect(`${frontendUrl}/dashboard?youtube=error`);
  }

  // Validate we got the required parameters
  if (!code || !state) {
    return res.redirect(`${frontendUrl}/dashboard?youtube=error&reason=missing_parameters`);
  }

  // Call service to process the callback
  const result = await this.youtubeService.handleOAuthCallback(code, state);

  // Redirect user back to frontend with success/error message
  if (result.success) {
    return res.redirect(`${frontendUrl}/dashboard?youtube=connected`);
  } else {
    return res.redirect(`${frontendUrl}/dashboard?youtube=error`);
  }
}
```

**Flow:**

- Google redirects to: `GET /api/youtube/callback?code=XXX&state=YYY`
- Controller extracts: `code` (from Google) and `state` (contains user ID)
- Controller calls: `youtubeService.handleOAuthCallback(code, state)`
- Controller redirects: User back to frontend with success/error

---

### 4. **Service: YouTubeService** (`src/youtube/youtube.service.ts`)

**What it does:** Contains all the business logic - the actual work of connecting YouTube.

Think of it as the **worker** - it does the heavy lifting.

#### Method 1: Generate OAuth URL

```typescript
generateAuthUrl(userId: string): string {
  // Get credentials from environment variables
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || "http://localhost:3000/api/youtube/callback";

  // Encode the user ID in "state" parameter (so we know which user authorized later)
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  // Example: If userId is "abc123", state becomes something like "eyJ1c2VySWQiOiJhYmMxMjMifQ=="

  // Build the Google OAuth URL with all required parameters
  const params = new URLSearchParams({
    client_id: clientId,                    // Our app's Google OAuth client ID
    redirect_uri: redirectUri,               // Where Google should redirect after auth
    response_type: "code",                  // We want an authorization code
    scope: "https://www.googleapis.com/auth/youtube.readonly",  // What permissions we need
    access_type: "offline",                 // We want a refresh token too
    prompt: "consent",                      // Always show consent screen
    state: state,                           // Our encoded user ID
  });

  // Create the full URL
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  // Example: https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&...

  return authUrl;
}
```

**What happens:**

1. Takes user ID
2. Encodes it in the `state` parameter (so we can identify them later)
3. Builds Google OAuth URL with required parameters
4. Returns the URL for frontend to redirect user to

---

#### Method 2: Handle OAuth Callback

```typescript
async handleOAuthCallback(code: string, state: string): Promise<{ success: boolean; message: string }> {
  // Step 1: Decode the state to get the user ID
  const decodedState = JSON.parse(Buffer.from(state, "base64").toString());
  const userId = decodedState.userId;  // "abc123"

  // Step 2: Exchange authorization code for access tokens
  // Google gave us a "code", we need to trade it for actual tokens we can use
  const tokens = await this.exchangeCodeForTokens(code);
  // Returns: { access_token: "ya29...", refresh_token: "1//...", expires_in: 3600 }

  // Step 3: Use access token to get channel information
  const channelData = await this.getChannelInfo(tokens.access_token);
  // Returns: { id: "UCxxxxx", title: "My Channel", videoCount: 50, ... }

  // Step 4: Save all this information to the database
  await this.updateUserYouTubeCredentials(userId, {
    youtubeChannelId: channelData.id,
    youtubeAccessToken: tokens.access_token,
    youtubeRefreshToken: tokens.refresh_token,
    youtubeTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  });

  // Step 5: Automatically sync all videos from the channel
  const syncResult = await this.syncChannelVideos(userId);

  return {
    success: true,
    message: `Successfully connected to channel: ${channelData.title}`,
  };
}
```

**What happens:**

1. Decodes `state` to get user ID
2. Exchanges Google's `code` for `access_token` and `refresh_token`
3. Uses `access_token` to fetch channel info from YouTube
4. Saves everything to database
5. Auto-syncs videos
6. Returns success

---

#### Method 3: Exchange Code for Tokens

```typescript
private async exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  // Get our app's credentials
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

  // Make HTTP request to Google's token endpoint
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,                      // The authorization code Google gave us
      client_id: clientId,       // Our app ID
      client_secret: clientSecret,  // Our app secret (proves we're the real app)
      redirect_uri: redirectUri,  // Must match what we sent in auth URL
      grant_type: "authorization_code",  // We're exchanging a code for tokens
    }),
  });

  const data = await response.json();
  // Returns: { access_token: "ya29...", refresh_token: "1//...", expires_in: 3600 }

  return {
    access_token: data.access_token,      // Use this to call YouTube API
    refresh_token: data.refresh_token,    // Use this to get new access tokens
    expires_in: data.expires_in || 3600,  // Token expires in 1 hour
  };
}
```

**What happens:**

1. Takes the authorization `code` from Google
2. Sends it to Google's token endpoint with our app credentials
3. Google verifies everything is correct
4. Google returns `access_token` and `refresh_token`
5. We return these tokens to save in database

---

#### Method 4: Get Channel Info

```typescript
async getChannelInfo(accessToken: string): Promise<YouTubeChannelData> {
  // Call YouTube API to get the authenticated user's channel info
  const myChannelResponse = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,  // Use the access token
      },
    }
  );

  const myChannelData = await myChannelResponse.json();
  // Returns: { items: [{ id: "UCxxxxx", snippet: { title: "...", ... }, statistics: {...} }] }

  const channel = myChannelData.items[0];

  // Extract the information we need
  return {
    id: channel.id,                    // Channel ID
    title: channel.snippet.title,      // Channel name
    description: channel.snippet.description,
    thumbnail: channel.snippet.thumbnails?.high?.url,
    subscriberCount: parseInt(channel.statistics.subscriberCount || "0", 10),
    videoCount: parseInt(channel.statistics.videoCount || "0", 10),
  };
}
```

**What happens:**

1. Makes HTTP request to YouTube API with access token
2. YouTube API identifies the user from the token
3. Returns their channel information
4. We extract and format the data we need

---

#### Method 5: Get Channel Videos

```typescript
private async getChannelVideos(accessToken: string, channelId: string): Promise<YouTubeVideoData[]> {
  // Step 1: Get the channel's "uploads" playlist ID
  // Every channel has an automatic playlist with ALL their videos (including unlisted)
  const channelResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const channelData = await channelResponse.json();
  const uploadsPlaylistId = channelData.items[0].contentDetails?.relatedPlaylists?.uploads;
  // Example: "UUxxxxx" (all videos the channel uploaded)

  // Step 2: Get all videos from that playlist (with pagination)
  const videos: YouTubeVideoData[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    // Get one page of videos (max 50 at a time)
    let playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50`;
    if (nextPageToken) {
      playlistUrl += `&pageToken=${nextPageToken}`;
    }

    const playlistResponse = await fetch(playlistUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const playlistData = await playlistResponse.json();

    // Get video IDs from this page
    const videoIds = playlistData.items
      .map((item: any) => item.contentDetails?.videoId)
      .filter((id: string) => id)
      .join(",");  // "video1,video2,video3"

    // Step 3: Get detailed info about these videos
    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${videoIds}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const detailsData = await detailsResponse.json();

    // Process each video
    for (const video of detailsData.items || []) {
      videos.push({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails?.high?.url,
        duration: video.contentDetails.duration,
        publishedAt: video.snippet.publishedAt,
        status: video.status.privacyStatus,  // "public", "unlisted", or "private"
        viewCount: parseInt(video.statistics.viewCount || "0", 10),
        likeCount: parseInt(video.statistics.likeCount || "0", 10),
        commentCount: parseInt(video.statistics.commentCount || "0", 10),
      });
    }

    // Check if there are more pages
    nextPageToken = playlistData.nextPageToken;
  } while (nextPageToken);  // Keep going until no more pages

  return videos;
}
```

**What happens:**

1. Gets the channel's uploads playlist ID (contains ALL videos)
2. Fetches videos from playlist page by page (YouTube limits to 50 per request)
3. For each page, gets detailed video information
4. Combines all videos into one array
5. Returns complete list

---

#### Method 6: Save Credentials to Database

```typescript
private async updateUserYouTubeCredentials(
  userId: string,
  credentials: {
    youtubeChannelId: string;
    youtubeAccessToken: string;
    youtubeRefreshToken: string;
    youtubeTokenExpiresAt: Date;
  }
): Promise<void> {
  // Simple database update - saves credentials to user record
  await this.userRepository.update(userId, credentials);
  // This updates the User entity in the database
}
```

**What happens:**

1. Takes user ID and credentials
2. Updates the user record in database
3. Saves channel ID, access token, refresh token, and expiration time

---

#### Method 7: Sync Videos to Database

```typescript
async syncChannelVideos(userId: string): Promise<{
  success: boolean;
  videosCount: number;
  newVideosCount: number;
  updatedVideosCount: number;
  unlistedVideosCount: number;
}> {
  // Step 1: Get user from database (with YouTube credentials)
  const user = await this.userRepository.findOne({
    where: { id: userId },
    select: ["id", "youtubeChannelId", "youtubeAccessToken", ...],
  });

  if (!user || !user.youtubeAccessToken) {
    throw new BadRequestException("User not connected to YouTube");
  }

  // Step 2: Refresh token if expired
  const accessToken = await this.refreshTokenIfNeeded(user);

  // Step 3: Get all videos from YouTube
  const channelVideos = await this.getChannelVideos(accessToken, user.youtubeChannelId);

  // Step 4: For each video, save or update in our database
  let newVideosCount = 0;
  let updatedVideosCount = 0;

  for (const videoData of channelVideos) {
    // Check if video already exists in our database
    const existingVideo = await this.videoRepository.findOne({
      where: { youtubeId: videoData.id },
    });

    if (existingVideo) {
      // Update existing video with latest info
      await this.updateVideoFromYouTubeData(existingVideo, videoData);
      updatedVideosCount++;
    } else {
      // Create new video in database
      await this.createVideoFromYouTubeData(userId, videoData);
      newVideosCount++;
    }
  }

  return {
    success: true,
    videosCount: channelVideos.length,
    newVideosCount,
    updatedVideosCount,
    unlistedVideosCount: channelVideos.filter(v => v.status === "unlisted").length,
  };
}
```

**What happens:**

1. Gets user and their YouTube credentials
2. Refreshes token if needed
3. Fetches all videos from YouTube API
4. For each video:
   - If it exists in our DB → update it
   - If it doesn't exist → create it
5. Returns summary of what was synced

---

## 🔗 How Everything Connects Together

### Registration in App Module

```typescript
// src/app.module.ts
@Module({
  imports: [
    // ... other modules ...
    YouTubeModule, // ← This registers YouTubeModule
  ],
})
export class AppModule {}
```

**What this does:** Tells NestJS to load the YouTubeModule, making all its endpoints available.

---

### Dependency Injection Magic

```typescript
// In YouTubeController
constructor(@Inject(YouTubeService) private youtubeService: YouTubeService) {}

// In YouTubeService
constructor(
  @InjectRepository(User)
  private userRepository: Repository<User>,
  @InjectRepository(Video)
  private videoRepository: Repository<Video>
) {}
```

**What this does:** NestJS automatically provides:

- `YouTubeService` to `YouTubeController`
- `User` and `Video` repositories to `YouTubeService`

You don't manually create these - NestJS handles it automatically!

---

## 🎬 Complete Flow Example

Let's trace a complete connection:

### Step 1: Frontend Requests Auth URL

```typescript
// Frontend code
const response = await fetch("http://localhost:3000/api/youtube/auth-url", {
  headers: {
    Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  },
});

const { authUrl } = await response.json();
// authUrl = "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
```

**Backend process:**

1. Request hits `YouTubeController.getAuthUrl()`
2. JWT token is validated → extracts user
3. Controller calls `youtubeService.generateAuthUrl("user-id-123")`
4. Service builds Google OAuth URL with user ID encoded in `state`
5. Returns URL to frontend

---

### Step 2: User Authorizes on Google

```typescript
// Frontend redirects user
window.location.href = authUrl;
// User sees Google login page
// User clicks "Allow"
```

**What Google does:**

- User logs in
- User grants permissions
- Google generates an authorization `code`
- Google redirects to: `http://localhost:3000/api/youtube/callback?code=4/0AX4X...&state=eyJ1c2VySWQiOiJhYmMxMjMifQ==`

---

### Step 3: Backend Processes Callback

**Backend receives:**

```
GET /api/youtube/callback?code=4/0AX4X...&state=eyJ1c2VySWQiOiJhYmMxMjMifQ==
```

**Backend process:**

1. Request hits `YouTubeController.handleCallback()`
2. Extracts `code` and `state` from URL
3. Controller calls `youtubeService.handleOAuthCallback(code, state)`
4. Service decodes `state` → gets `userId = "user-id-123"`
5. Service calls `exchangeCodeForTokens(code)`:
   - Sends code to Google
   - Gets back `access_token` and `refresh_token`
6. Service calls `getChannelInfo(access_token)`:
   - Calls YouTube API
   - Gets channel info: `{ id: "UCxxxxx", title: "My Channel", ... }`
7. Service calls `updateUserYouTubeCredentials(userId, {...})`:
   - Saves to database: channel ID, tokens, expiration
8. Service calls `syncChannelVideos(userId)`:
   - Gets videos from YouTube
   - Saves to database
9. Controller redirects to frontend: `/dashboard?youtube=connected`

---

## 📊 Database Changes

Before connection:

```sql
SELECT * FROM users WHERE id = 'user-id-123';
-- youtubeChannelId: NULL
-- youtubeAccessToken: NULL
-- youtubeRefreshToken: NULL
```

After connection:

```sql
SELECT * FROM users WHERE id = 'user-id-123';
-- youtubeChannelId: 'UCxxxxx'
-- youtubeAccessToken: 'ya29.a0AfH6SMC...'
-- youtubeRefreshToken: '1//0ge...'
-- youtubeTokenExpiresAt: '2025-10-29 16:05:51'
```

And videos are created:

```sql
SELECT * FROM videos WHERE "creatorId" = 'user-id-123';
-- Multiple rows with video data from YouTube
```

---

## 🔐 Security Features

1. **JWT Authentication:** User must be logged in
2. **Role-Based Access:** Only CREATOR/ADMIN roles can connect
3. **Token Security:** Tokens stored with `select: false` (hidden by default)
4. **State Parameter:** Prevents CSRF attacks - user ID encoded in state
5. **Token Refresh:** Automatically refreshes expired tokens

---

## 🛠️ Environment Variables Needed

```env
# YouTube OAuth credentials (from Google Cloud Console)
YOUTUBE_CLIENT_ID=your_client_id_here
YOUTUBE_CLIENT_SECRET=your_client_secret_here

# Where Google should redirect after authorization
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback

# Where to redirect after connection succeeds
FRONTEND_URL=http://localhost:5179
```

---

## 📁 File Structure

```
src/
├── entities/
│   └── user.entity.ts          ← User database model (YouTube fields)
│
├── youtube/
│   ├── youtube.module.ts       ← Module registration
│   ├── youtube.controller.ts   ← HTTP endpoints
│   └── youtube.service.ts      ← Business logic (OAuth, API calls)
│
└── app.module.ts                ← Registers YouTubeModule
```

---

## 🎓 Key Concepts Explained

### OAuth 2.0 (In Simple Terms)

Think of it like a hotel key card:

1. You show ID at front desk (Google login)
2. Front desk gives you a temporary card (authorization code)
3. You exchange card for room key (access token)
4. Room key works for a limited time (token expires)
5. If it expires, you use your ID again (refresh token)

### State Parameter

The `state` parameter is like a receipt number:

- You send your user ID encoded in state
- Google gives it back to you after authorization
- You can verify it's the same user who started the process
- Prevents malicious redirects

### Access Token vs Refresh Token

- **Access Token:** Like a day pass - works for ~1 hour, used for API calls
- **Refresh Token:** Like a master key - doesn't expire, used to get new access tokens

---

## 🧪 Testing the Connection

You can test if everything works:

```bash
# 1. Get auth URL
curl -X GET http://localhost:3000/api/youtube/auth-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 2. Test connection status
curl -X GET http://localhost:3000/api/youtube/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 3. Get all videos
curl -X GET http://localhost:3000/api/youtube/videos \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## ✅ Summary

**The YouTube connection flow consists of:**

1. **Entity** (`user.entity.ts`) - Database structure to store YouTube data
2. **Module** (`youtube.module.ts`) - Tells NestJS how to organize everything
3. **Controller** (`youtube.controller.ts`) - HTTP endpoints that frontend calls
4. **Service** (`youtube.service.ts`) - Business logic that does the actual work:
   - Generates OAuth URLs
   - Exchanges codes for tokens
   - Fetches channel info
   - Fetches videos
   - Saves everything to database
5. **Integration** - All registered in `app.module.ts`

**The flow:**
Frontend → Controller → Service → YouTube API → Database → Service → Controller → Frontend

That's the complete implementation! 🎉
